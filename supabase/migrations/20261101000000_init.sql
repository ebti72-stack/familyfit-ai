-- FamilyFit AI — initial schema
-- Postgres + Supabase Auth. Every table has Row Level Security enabled.
-- Privacy model:
--   * A user only ever sees rows that belong to a family they are a member of.
--   * Personal health data (health_profiles, daily_goals, food/hydration/activity/sleep logs)
--     is visible only to the member themself, or to the family admin when the member is a
--     managed (child) profile without its own login, or when the member explicitly shared it.
--   * Leaderboard points are habit-based and visible to the whole family. Points are only
--     written by security-definer functions that verify the habit server-side.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type member_role as enum ('admin', 'adult', 'teen', 'child');
create type sex_type as enum ('female', 'male');
create type activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type health_goal as enum ('healthy_lifestyle', 'fitness', 'healthy_habits', 'more_activity', 'hydration_sleep', 'weight_loss', 'weight_gain');
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type log_source as enum ('manual', 'barcode', 'recipe', 'next_meal', 'photo', 'label_ocr');

-- ---------------------------------------------------------------------------
-- Accounts & families
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid not null references public.users(id) on delete cascade,
  -- Points per habit; editable by the family admin.
  points_config jsonb not null default '{"water_goal":10,"steps_goal":20,"activity":20,"meal_logged":10,"sleep_routine":10,"weekly_challenge":50}',
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,   -- null => managed profile (e.g. young child)
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  avatar_emoji text,
  role member_role not null default 'adult',
  managed_by uuid references public.users(id) on delete set null,
  share_health_with_admin boolean not null default false,
  parental_consent_at timestamptz,          -- required for child / teen profiles
  created_at timestamptz not null default now(),
  unique (family_id, user_id),
  check (user_id is not null or managed_by is not null),
  check (role not in ('child', 'teen') or parental_consent_at is not null or user_id is not null)
);
create index on public.family_members (user_id);
create index on public.family_members (family_id);

create table public.health_profiles (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  birth_date date not null,
  sex sex_type not null,
  height_cm numeric(5,1) not null check (height_cm between 40 and 250),
  weight_kg numeric(5,1) check (weight_kg between 8 and 350),     -- optional
  activity_level activity_level not null default 'light',
  goal health_goal not null default 'healthy_lifestyle',
  dietary_preferences text[] not null default '{}',
  allergies text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  declared_conditions text,               -- free text; triggers "consult a professional" notices only
  updated_at timestamptz not null default now()
);

create table public.daily_goals (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  kcal int not null check (kcal between 600 and 6000),
  protein_g int not null,
  carbs_g int not null,
  fat_g int not null,
  fiber_g int not null,
  sugar_g_max int not null,
  sat_fat_g_max int not null,
  sodium_mg_max int not null,
  water_ml int not null check (water_ml between 300 and 6000),
  steps int not null default 7000,
  active_minutes int not null default 30,
  sleep_hours numeric(3,1) not null default 8,
  is_custom boolean not null default false,  -- true when the user edited the computed values
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  favorite_recipes text[] not null default '{}',
  rejected_recipes text[] not null default '{}',
  pantry text[] not null default '{}',             -- ingredients available at home
  budget_tier int not null default 2 check (budget_tier between 1 and 3),
  notifications jsonb not null default '{"water":true,"meals":true,"activity":true,"sleep":false,"quiet_start":"22:00","quiet_end":"07:00"}',
  allow_ai_training boolean not null default false, -- never true unless explicitly opted in
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Food reference data
-- ---------------------------------------------------------------------------
-- Generic foods with nutrition per 100 g from a structured source (USDA FoodData Central).
create table public.food_items (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  category text not null,
  kcal numeric not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null,
  fiber_g numeric not null default 0, sugar_g numeric not null default 0,
  sat_fat_g numeric not null default 0, sodium_mg numeric not null default 0,
  allergens text[] not null default '{}',
  source text not null default 'USDA FoodData Central',
  source_ref text
);

-- Packaged products (cache of Open Food Facts + family-entered products).
create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,  -- null => shared OFF cache
  name text not null,
  brand text,
  image_url text,
  kcal_100g numeric not null, protein_100g numeric not null, carbs_100g numeric not null, fat_100g numeric not null,
  fiber_100g numeric, sugar_100g numeric, sat_fat_100g numeric, sodium_mg_100g numeric,
  serving_size_g numeric,
  serving_label text,
  ingredients_text text,
  allergens text[] not null default '{}',
  source text not null check (source in ('open_food_facts', 'family_manual', 'label_ocr')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.food_barcodes (
  barcode text not null check (barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  product_id uuid not null references public.food_products(id) on delete cascade,
  format text,
  family_id uuid references public.families(id) on delete cascade,
  primary key (barcode, product_id)
);
create index on public.food_barcodes (barcode);

create table public.recipes (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  meal_types meal_type[] not null,
  category text not null,
  prep_minutes int not null,
  cost_tier int not null check (cost_tier between 1 and 3),
  kid_friendly boolean not null default false,
  ingredients jsonb not null,              -- [{food_item_id, grams, substitutes:[food_item_id]}]
  steps_ar text[] not null,
  steps_en text[] not null,
  image_url text,
  tags text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- Logs
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  meal_type meal_type not null,
  title text not null,
  source log_source not null,
  -- client-generated idempotency key: the same scan/suggestion submitted twice is stored once
  dedupe_key text not null,
  kcal numeric not null default 0, protein_g numeric not null default 0, carbs_g numeric not null default 0, fat_g numeric not null default 0,
  fiber_g numeric not null default 0, sugar_g numeric not null default 0, sat_fat_g numeric not null default 0, sodium_mg numeric not null default 0,
  unique (member_id, dedupe_key)
);
create index on public.food_logs (member_id, log_date);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null references public.food_logs(id) on delete cascade,
  name text not null,
  food_item_id text references public.food_items(id),
  product_id uuid references public.food_products(id) on delete set null,
  grams numeric not null check (grams > 0 and grams <= 3000),
  kcal numeric not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null,
  fiber_g numeric not null default 0, sugar_g numeric not null default 0, sat_fat_g numeric not null default 0, sodium_mg numeric not null default 0
);
create index on public.meal_items (food_log_id);

-- Keep the food_log totals equal to the sum of its items (single source of truth, no double counting).
create or replace function public.recalc_food_log_totals() returns trigger language plpgsql as $$
declare fid uuid := coalesce(new.food_log_id, old.food_log_id);
begin
  update public.food_logs l set
    kcal = s.kcal, protein_g = s.p, carbs_g = s.c, fat_g = s.f,
    fiber_g = s.fi, sugar_g = s.su, sat_fat_g = s.sf, sodium_mg = s.na
  from (select coalesce(sum(kcal),0) kcal, coalesce(sum(protein_g),0) p, coalesce(sum(carbs_g),0) c, coalesce(sum(fat_g),0) f,
               coalesce(sum(fiber_g),0) fi, coalesce(sum(sugar_g),0) su, coalesce(sum(sat_fat_g),0) sf, coalesce(sum(sodium_mg),0) na
        from public.meal_items where food_log_id = fid) s
  where l.id = fid;
  return null;
end $$;
create trigger meal_items_totals after insert or update or delete on public.meal_items
  for each row execute function public.recalc_food_log_totals();

create table public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  ml int not null check (ml between 10 and 2000)
);
create index on public.hydration_logs (member_id, log_date);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  activity_type text not null,
  minutes int not null default 0 check (minutes between 0 and 600),
  steps int not null default 0 check (steps between 0 and 100000),
  distance_km numeric,
  kcal_estimate numeric,                -- MET-based estimate, always shown as approximate
  source text not null default 'manual' -- 'manual' until Apple Health / Health Connect is linked
);
create index on public.activity_logs (member_id, log_date);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  log_date date not null,               -- the morning the sleep ended
  bedtime timestamptz not null,
  wake_time timestamptz not null,
  quality int check (quality between 1 and 5),
  check (wake_time > bedtime),
  unique (member_id, log_date)
);

create table public.exercise_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null,
  plan_date date not null,
  meal_type meal_type not null,
  recipe_id text references public.recipes(id),
  portions jsonb not null default '{}',  -- {member_id: portion_factor}
  created_by uuid references public.users(id) on delete set null,
  unique (family_id, plan_date, meal_type)
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]',     -- [{food_item_id, name, grams, aisle, have:boolean}]
  updated_at timestamptz not null default now(),
  unique (family_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Family competition
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  kind text not null,                   -- walking, water, fruit, veg, movement, sleep, healthy_meal
  is_collaborative boolean not null default false,
  target numeric not null,
  unit text not null,
  starts_on date not null,
  ends_on date not null,
  bonus_points int not null default 50,
  badge text,
  created_by uuid references public.users(id) on delete set null,
  check (ends_on >= starts_on)
);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  progress numeric not null default 0,
  completed_at timestamptz,
  primary key (challenge_id, member_id)
);

create table public.leaderboard_points (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  log_date date not null,
  reason text not null,                  -- water_goal, steps_goal, activity, meal_logged, sleep_routine, challenge:<id>
  points int not null check (points between 0 and 1000),
  created_at timestamptz not null default now(),
  unique (member_id, log_date, reason)   -- each habit counts once per day
);
create index on public.leaderboard_points (family_id, log_date);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  unique (member_id, code)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  cost_points int not null check (cost_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null,                    -- next_meal, product_assessment, coach
  input_snapshot jsonb not null,         -- remaining macros etc. used for the suggestion
  output jsonb not null,
  accepted boolean,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer, stable, fixed search_path)
-- ---------------------------------------------------------------------------
create or replace function public.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.is_family_admin(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid() and role = 'admin');
$$;

-- Can the caller read/write this member's personal health data?
create or replace function public.can_access_member(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members m
    where m.id = mid and (
      m.user_id = auth.uid()
      or (m.user_id is null and m.managed_by = auth.uid())
      or (m.user_id is null and public.is_family_admin(m.family_id))
      or (m.share_health_with_admin and public.is_family_admin(m.family_id))
    )
  );
$$;

create or replace function public.member_family(mid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from family_members where id = mid;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.health_profiles enable row level security;
alter table public.daily_goals enable row level security;
alter table public.user_preferences enable row level security;
alter table public.food_items enable row level security;
alter table public.food_products enable row level security;
alter table public.food_barcodes enable row level security;
alter table public.recipes enable row level security;
alter table public.food_logs enable row level security;
alter table public.meal_items enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.exercise_plans enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.leaderboard_points enable row level security;
alter table public.achievements enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_recommendations enable row level security;

-- users: self, plus names of people in the same family
create policy users_self on public.users for all using (id = auth.uid()) with check (id = auth.uid());
create policy users_family_read on public.users for select using (
  exists (select 1 from family_members a join family_members b on a.family_id = b.family_id
          where a.user_id = auth.uid() and b.user_id = users.id));

-- families
create policy families_read on public.families for select using (public.is_family_member(id));
create policy families_admin_update on public.families for update using (public.is_family_admin(id)) with check (public.is_family_admin(id));
create policy families_admin_delete on public.families for delete using (public.is_family_admin(id));
-- inserts go through create_family()

-- family_members: everyone in the family sees names/avatars/roles (no health data lives here)
create policy members_read on public.family_members for select using (public.is_family_member(family_id));
create policy members_admin_insert on public.family_members for insert
  with check (public.is_family_admin(family_id) and user_id is null and managed_by = auth.uid());
create policy members_update on public.family_members for update
  using (user_id = auth.uid() or public.is_family_admin(family_id))
  with check (user_id = auth.uid() or public.is_family_admin(family_id));
create policy members_delete on public.family_members for delete
  using (user_id = auth.uid() or public.is_family_admin(family_id));

-- personal health tables
create policy hp_all on public.health_profiles for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy dg_all on public.daily_goals for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy prefs_self on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy food_logs_all on public.food_logs for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy meal_items_all on public.meal_items for all
  using (exists (select 1 from food_logs l where l.id = food_log_id and public.can_access_member(l.member_id)))
  with check (exists (select 1 from food_logs l where l.id = food_log_id and public.can_access_member(l.member_id)));
create policy hydration_all on public.hydration_logs for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy activity_all on public.activity_logs for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy sleep_all on public.sleep_logs for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy exercise_plans_all on public.exercise_plans for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy ai_reco_all on public.ai_recommendations for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and family_id = public.member_family(member_id));
create policy achievements_read on public.achievements for select using (public.is_family_member(family_id));

-- reference data: readable by any signed-in user
create policy food_items_read on public.food_items for select to authenticated using (true);
create policy recipes_read on public.recipes for select to authenticated using (true);

-- products: OFF cache is shared; family products only within the family
create policy products_read on public.food_products for select to authenticated
  using (family_id is null or public.is_family_member(family_id));
create policy products_insert on public.food_products for insert to authenticated
  with check (created_by = auth.uid() and (
    (family_id is null and source = 'open_food_facts') or
    (family_id is not null and public.is_family_member(family_id))));
create policy products_update on public.food_products for update to authenticated
  using (family_id is not null and public.is_family_member(family_id));
create policy barcodes_read on public.food_barcodes for select to authenticated
  using (family_id is null or public.is_family_member(family_id));
create policy barcodes_insert on public.food_barcodes for insert to authenticated
  with check (family_id is null or public.is_family_member(family_id));

-- family-wide planning & competition
create policy meal_plans_all on public.meal_plans for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy shopping_all on public.shopping_lists for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy challenges_read on public.challenges for select using (public.is_family_member(family_id));
create policy challenges_admin on public.challenges for all using (public.is_family_admin(family_id)) with check (public.is_family_admin(family_id));
create policy cp_read on public.challenge_participants for select using (
  exists (select 1 from challenges c where c.id = challenge_id and public.is_family_member(c.family_id)));
create policy cp_admin on public.challenge_participants for all using (
  exists (select 1 from challenges c where c.id = challenge_id and public.is_family_admin(c.family_id)));
create policy points_read on public.leaderboard_points for select using (public.is_family_member(family_id));
-- no insert/update policy: points are written only by award_habit_points()
create policy rewards_read on public.rewards for select using (public.is_family_member(family_id));
create policy rewards_admin on public.rewards for all using (public.is_family_admin(family_id)) with check (public.is_family_admin(family_id));
create policy redemptions_read on public.reward_redemptions for select using (public.is_family_member(family_id));
create policy redemptions_admin on public.reward_redemptions for update using (public.is_family_admin(family_id));
create policy notifications_self on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Create a user row automatically on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
          coalesce(new.raw_user_meta_data->>'locale', 'ar'))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_family(family_name text, my_name text, my_emoji text default null)
returns public.family_members language plpgsql security definer set search_path = public as $$
declare f families; m family_members;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into families (name, created_by) values (family_name, auth.uid()) returning * into f;
  insert into family_members (family_id, user_id, display_name, avatar_emoji, role)
  values (f.id, auth.uid(), my_name, my_emoji, 'admin') returning * into m;
  return m;
end $$;

create or replace function public.join_family(code text, my_name text, my_role member_role default 'adult', my_emoji text default null)
returns public.family_members language plpgsql security definer set search_path = public as $$
declare f families; m family_members;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if my_role = 'admin' then my_role := 'adult'; end if;
  select * into f from families where invite_code = upper(trim(code));
  if not found then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into family_members (family_id, user_id, display_name, avatar_emoji, role)
  values (f.id, auth.uid(), my_name, my_emoji, my_role)
  on conflict (family_id, user_id) do update set display_name = excluded.display_name
  returning * into m;
  return m;
end $$;

-- Award habit points after verifying the habit from the caller's own logs.
-- Idempotent per (member, day, reason).
create or replace function public.award_habit_points(mid uuid, day date, habit text)
returns int language plpgsql security definer set search_path = public as $$
declare fam uuid; cfg jsonb; pts int; ok boolean := false; g daily_goals; inserted int;
begin
  if not public.can_access_member(mid) then raise exception 'forbidden'; end if;
  if day > current_date + 1 or day < current_date - 2 then raise exception 'day out of range'; end if;
  select family_id into fam from family_members where id = mid;
  select points_config into cfg from families where id = fam;
  select * into g from daily_goals where member_id = mid;
  if habit = 'water_goal' then
    ok := g.member_id is not null and (select coalesce(sum(ml),0) from hydration_logs where member_id = mid and log_date = day) >= g.water_ml;
  elsif habit = 'meal_logged' then
    ok := exists (select 1 from food_logs where member_id = mid and log_date = day);
  elsif habit = 'activity' then
    ok := (select coalesce(sum(minutes),0) from activity_logs where member_id = mid and log_date = day) >= 15;
  elsif habit = 'steps_goal' then
    ok := g.member_id is not null and (select coalesce(sum(steps),0) from activity_logs where member_id = mid and log_date = day) >= g.steps;
  elsif habit = 'sleep_routine' then
    ok := exists (select 1 from sleep_logs where member_id = mid and log_date = day
                  and extract(epoch from wake_time - bedtime) / 3600 >= coalesce(g.sleep_hours, 8) - 1);
  else
    raise exception 'unknown habit %', habit;
  end if;
  if not ok then return 0; end if;
  pts := coalesce((cfg->>habit)::int, 0);
  insert into leaderboard_points (family_id, member_id, log_date, reason, points)
  values (fam, mid, day, habit, pts)
  on conflict (member_id, log_date, reason) do nothing;
  get diagnostics inserted = row_count;
  return case when inserted = 1 then pts else 0 end;
end $$;

-- Leaderboard: habit points only (never weight, body shape, calories burned or deficits).
create or replace function public.family_leaderboard(fid uuid, from_day date, to_day date)
returns table (member_id uuid, display_name text, avatar_emoji text, role member_role, points bigint, active_days bigint)
language sql stable security definer set search_path = public as $$
  select m.id, m.display_name, m.avatar_emoji, m.role,
         coalesce(sum(p.points), 0) as points,
         count(distinct p.log_date) as active_days
  from family_members m
  left join leaderboard_points p on p.member_id = m.id and p.log_date between from_day and to_day
  where m.family_id = fid and public.is_family_member(fid)
  group by m.id
  order by points desc, m.display_name;
$$;

-- Account deletion of the caller's own app data (auth user removal is done by the delete-account edge function).
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from families where created_by = auth.uid()
    and not exists (select 1 from family_members m where m.family_id = families.id and m.user_id <> auth.uid() and m.user_id is not null);
  delete from family_members where user_id = auth.uid() or managed_by = auth.uid();
  delete from users where id = auth.uid();
end $$;

revoke all on function public.award_habit_points(uuid, date, text) from public, anon;
grant execute on function public.award_habit_points(uuid, date, text) to authenticated;
grant execute on function public.create_family(text, text, text) to authenticated;
grant execute on function public.join_family(text, text, member_role, text) to authenticated;
grant execute on function public.family_leaderboard(uuid, date, date) to authenticated;
grant execute on function public.delete_my_data() to authenticated;

-- Realtime for the leaderboard and family member list
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leaderboard_points, public.family_members;
  end if;
end $$;
