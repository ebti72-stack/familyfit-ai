-- FamilyFit AI — smart fasting, recipe analyzer, favourites, recipe documents & translations.
-- Same principles as the init migration:
--   * every table has RLS; access goes through can_access_member() / is_family_member();
--   * nutrition is computed from food_items in the database, never stored from an AI answer;
--   * fasting badges are issued only by the server, and only from user-confirmed completed days;
--   * no ranking by fasting days: the family challenge exposes an anonymous total only.

alter type public.meal_type add value if not exists 'suhoor';
alter type public.meal_type add value if not exists 'iftar';

alter table public.user_preferences add column if not exists favorites_first boolean not null default true;

-- ============================================================================
-- Fasting
-- ============================================================================
create type public.fasting_type as enum ('three_monthly', 'mon_thu', 'ayyam_bid', 'ramadan', 'voluntary', 'custom');
create type public.fasting_status as enum ('planned', 'fasting', 'completed', 'broken');

create table public.fasting_profiles (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  enabled boolean not null default false,                 -- never switched on automatically
  hijri_offset smallint not null default 0 check (hijri_offset between -2 and 2),
  monthly_goal smallint not null default 3 check (monthly_goal between 0 and 30),
  join_family_challenge boolean not null default false,   -- opt-in, collaborative total only
  health_flags text[] not null default '{}' check (health_flags <@ array['pregnant','breastfeeding','diabetes','medication','chronic','eating_disorder']),
  health_ack boolean not null default false,
  suhoor_time time,
  iftar_time time,
  updated_at timestamptz not null default now()
);

create table public.fasting_schedules (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.family_members(id) on delete cascade,
  fasting_type public.fasting_type not null default 'three_monthly',
  days_of_week smallint[] not null default '{}' check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  hijri_days smallint[] not null default '{13,14,15}',
  start_date date,
  end_date date,
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.fasting_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  log_date date not null,
  status public.fasting_status not null,
  -- Hijri date as shown to the user (Umm al-Qura + their −2…+2 adjustment), used for monthly badges.
  hijri_year int not null check (hijri_year between 1400 and 1600),
  hijri_month smallint not null check (hijri_month between 1 and 12),
  hijri_day smallint not null check (hijri_day between 1 and 30),
  confirmed_at timestamptz,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, log_date),
  -- A completed day exists only as an explicit user confirmation.
  check (status <> 'completed' or confirmed_at is not null)
);
create index fasting_logs_member_hijri on public.fasting_logs (member_id, hijri_year, hijri_month);

create table public.fasting_badges (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  description_ar text not null,
  description_en text not null,
  premium boolean not null default false,
  sort smallint not null default 0
);

create table public.fasting_achievements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  badge_code text not null references public.fasting_badges(code),
  period_key text not null,                        -- 'all' or Hijri month 'YYYY-MM'
  earned_at timestamptz not null default now(),
  unique (member_id, badge_code, period_key)
);

insert into public.fasting_badges (code, name_ar, name_en, description_ar, description_en, premium, sort) values
  ('three_month', 'إنجاز صيام ثلاثة أيام من كل شهر', 'Three days every month', 'أكملت صيام 3 أيام في شهر هجري واحد.', 'Completed 3 fasting days in one Hijri month.', true, 1),
  ('first_fast', 'أول صيام', 'First fast', 'أكملت أول يوم صيام مسجّل.', 'Completed your first logged fast.', false, 2),
  ('six_month', 'صيام 6 أيام', 'Six days', 'أكملت 6 أيام صيام في شهر هجري واحد.', 'Completed 6 fasting days in one Hijri month.', false, 3),
  ('ten_total', 'صيام 10 أيام', 'Ten days', 'أكملت 10 أيام صيام مسجّلة.', 'Completed 10 logged fasting days.', false, 4),
  ('monthly_goal', 'إكمال التحدي الشهري', 'Monthly goal', 'حققت هدفك الشهري للصيام.', 'Reached your monthly fasting goal.', false, 5),
  ('consistency_3', 'الاستمرارية', 'Consistency', 'حققت شارة الأيام الثلاثة ثلاثة أشهر متتالية.', 'Earned the three-days badge three months in a row.', false, 6);

-- Children: fasting is never enabled without the guardian's explicit acknowledgement of the health note.
create or replace function public.guard_fasting_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare r member_role;
begin
  select role into r from family_members where id = new.member_id;
  if new.enabled and r in ('child', 'teen') and not new.health_ack then
    raise exception 'fasting for a minor requires the guardian health acknowledgement' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger fasting_profiles_guard before insert or update on public.fasting_profiles
  for each row execute function public.guard_fasting_profile();

create or replace function public.guard_fasting_log() returns trigger
language plpgsql as $$
begin
  if new.status = 'completed' and new.log_date > current_date + 1 then
    raise exception 'a future day cannot be marked as completed' using errcode = '22023';
  end if;
  if new.status <> 'completed' then new.confirmed_at := null; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger fasting_logs_guard before insert or update on public.fasting_logs
  for each row execute function public.guard_fasting_log();

-- Issue fasting badges from confirmed completed days only. Returns the badges newly earned.
create or replace function public.evaluate_fasting_badges(mid uuid)
returns table (badge_code text, period_key text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare goal int;
begin
  if not public.can_access_member(mid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(fp.monthly_goal, 0) into goal from fasting_profiles fp where fp.member_id = mid;
  goal := coalesce(goal, 0);
  return query
  with done as (
    select l.hijri_year y, l.hijri_month m from fasting_logs l
    where l.member_id = mid and l.status = 'completed' and l.confirmed_at is not null
  ),
  per_month as (
    select y, m, count(*) c, y * 12 + m - 1 idx, format('%s-%s', y, lpad(m::text, 2, '0')) k from done group by y, m
  ),
  earned as (
    select 'first_fast'::text b, 'all'::text p where (select count(*) from done) >= 1
    union all select 'ten_total', 'all' where (select count(*) from done) >= 10
    union all select 'three_month', k from per_month where c >= 3
    union all select 'six_month', k from per_month where c >= 6
    union all select 'monthly_goal', k from per_month where goal > 0 and c >= goal
    union all select 'consistency_3', a.k from per_month a
      where a.c >= 3
        and exists (select 1 from per_month b where b.idx = a.idx - 1 and b.c >= 3)
        and exists (select 1 from per_month c2 where c2.idx = a.idx - 2 and c2.c >= 3)
  ),
  ins as (
    insert into fasting_achievements (member_id, badge_code, period_key)
    select mid, e.b, e.p from earned e
    on conflict (member_id, badge_code, period_key) do nothing
    returning fasting_achievements.badge_code, fasting_achievements.period_key
  )
  select ins.badge_code, ins.period_key from ins;
end $$;

-- Optional family challenge: one anonymous total for members who opted in. No per-member numbers, no ranking.
create or replace function public.family_fasting_total(fid uuid, hy int, hm int)
returns table (participants int, completed_days int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from family_members m join fasting_profiles p on p.member_id = m.id
      where m.family_id = fid and p.join_family_challenge and p.enabled),
    (select count(*)::int from fasting_logs l
      join family_members m on m.id = l.member_id
      join fasting_profiles p on p.member_id = m.id
      where m.family_id = fid and p.join_family_challenge and p.enabled
        and l.status = 'completed' and l.confirmed_at is not null and l.hijri_year = hy and l.hijri_month = hm)
  where public.is_family_member(fid);
$$;

-- ============================================================================
-- Recipes (analyzer, favourites, family library, documents, translations)
-- ============================================================================
create type public.recipe_version as enum ('original', 'improved', 'translated');

create table public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.family_members(id) on delete cascade,  -- null = built-in folder
  code text not null,
  name_ar text not null,
  name_en text not null,
  sort smallint not null default 0,
  unique (member_id, code)
);
insert into public.recipe_categories (member_id, code, name_ar, name_en, sort) values
  (null, 'breakfast', 'الفطور', 'Breakfast', 1), (null, 'lunch', 'الغداء', 'Lunch', 2), (null, 'dinner', 'العشاء', 'Dinner', 3),
  (null, 'suhoor', 'السحور', 'Suhoor', 4), (null, 'iftar', 'الإفطار', 'Iftar', 5), (null, 'high_protein', 'عالية البروتين', 'High protein', 6),
  (null, 'snacks', 'سناكات', 'Snacks', 7), (null, 'kids', 'وجبات الأطفال', 'Kids', 8), (null, 'healthy', 'وصفات صحية', 'Healthy', 9),
  (null, 'quick', 'وصفات سريعة', 'Quick', 10), (null, 'family', 'وصفات العائلة', 'Family', 11), (null, 'mine', 'وصفاتي الخاصة', 'My recipes', 12);

create table public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_member_id uuid not null references public.family_members(id) on delete cascade,
  created_by uuid default auth.uid() references public.users(id) on delete set null,
  parent_id uuid references public.user_recipes(id) on delete set null,
  version_kind public.recipe_version not null default 'original',
  lang text not null default 'ar' check (lang in ('ar','en','fil','hi','ur','ne','fr')),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  emoji text,
  image_url text,
  source_kind text not null default 'manual' check (source_kind in ('link','video','text','photos','manual')),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  source_platform text,
  servings numeric(5,2) not null default 1 check (servings > 0 and servings <= 100),
  prep_minutes int check (prep_minutes between 0 and 1440),
  cook_minutes int check (cook_minutes between 0 and 1440),
  difficulty text check (difficulty in ('easy','medium','hard')),
  cooking_method text not null default 'none' check (cooking_method in ('none','boiled','baked','grilled','pan_fried','deep_fried','air_fried','steamed')),
  steps jsonb not null default '[]',                  -- [{text, minutes, temp_c}]
  tools text[] not null default '{}',
  notes text not null default '',
  serving_tip text not null default '',
  final_weight_g numeric check (final_weight_g is null or final_weight_g > 0),
  meal_types public.meal_type[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (version_kind = 'original' or parent_id is not null)
);
create index user_recipes_family on public.user_recipes (family_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.user_recipes(id) on delete cascade,
  position smallint not null,
  raw text not null default '',
  name text not null,
  food_item_id text references public.food_items(id),
  qty numeric,
  unit text check (unit in ('g','kg','ml','l','tsp','tbsp','cup','piece','clove','slice','can','pinch','handful')),
  grams numeric check (grams is null or (grams >= 0 and grams <= 20000)),
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  estimated boolean not null default false,
  to_taste boolean not null default false,
  confirmed boolean not null default false,
  unique (recipe_id, position)
);

-- Server-computed snapshot (from recipe_ingredients × food_items). No client write policy.
create table public.recipe_nutrition (
  recipe_id uuid primary key references public.user_recipes(id) on delete cascade,
  total jsonb not null,
  per_serving jsonb not null,
  per_100g jsonb,
  confidence text not null check (confidence in ('high','medium','low')),
  uncounted int not null default 0,
  absorbed_oil_g numeric not null default 0,
  computed_at timestamptz not null default now()
);

create table public.recipe_videos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  kind text not null check (kind in ('link','video','screen_recording','photos')),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  platform text check (platform in ('instagram','tiktok','youtube','facebook','pinterest','other')),
  storage_path text,
  status text not null default 'pending' check (status in ('pending','analyzed','failed','unsupported')),
  created_at timestamptz not null default now()
);

create table public.recipe_video_analysis (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.recipe_videos(id) on delete cascade,
  recipe_id uuid references public.user_recipes(id) on delete set null,
  model text,
  extracted jsonb,                                  -- names/quantities/steps only; nutrition is never taken from here
  confidence text check (confidence in ('high','medium','low')),
  error_code text,
  created_at timestamptz not null default now()
);

create table public.healthy_substitutions (
  id text primary key,
  from_foods text[] not null,
  to_food text,                                     -- null = "use less of the same food"
  ratio numeric not null check (ratio > 0 and ratio <= 3),
  reason_ar text not null, reason_en text not null,
  taste_ar text not null, taste_en text not null
);

create table public.favorite_recipes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  builtin_recipe_id text references public.recipes(id) on delete cascade,
  user_recipe_id uuid references public.user_recipes(id) on delete cascade,
  folders text[] not null default '{}',
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(builtin_recipe_id, user_recipe_id) = 1),
  unique (member_id, builtin_recipe_id),
  unique (member_id, user_recipe_id)
);

create table public.favorite_ingredients (
  member_id uuid not null references public.family_members(id) on delete cascade,
  food_item_id text not null references public.food_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, food_item_id)
);

create table public.recipe_ratings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  builtin_recipe_id text references public.recipes(id) on delete cascade,
  user_recipe_id uuid references public.user_recipes(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(builtin_recipe_id, user_recipe_id) = 1),
  unique (member_id, builtin_recipe_id),
  unique (member_id, user_recipe_id)
);

create table public.recipe_translations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  builtin_recipe_id text references public.recipes(id) on delete cascade,
  user_recipe_id uuid references public.user_recipes(id) on delete cascade,
  lang text not null check (lang in ('ar','en','fil','hi','ur','ne','fr')),
  title text not null,
  description text not null default '',
  ingredient_names text[] not null,
  steps text[] not null,
  notes text not null default '',
  serving_tip text not null default '',
  machine boolean not null default false,
  edited boolean not null default false,
  number_warnings int[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (num_nonnulls(builtin_recipe_id, user_recipe_id) = 1),
  unique (member_id, builtin_recipe_id, lang),
  unique (member_id, user_recipe_id, lang)
);

create table public.recipe_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  builtin_recipe_id text references public.recipes(id) on delete cascade,
  user_recipe_id uuid references public.user_recipes(id) on delete cascade,
  lang text not null check (lang in ('ar','en','fil','hi','ur','ne','fr')),
  options jsonb not null default '{}',
  storage_path text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(builtin_recipe_id, user_recipe_id) = 1)
);

create table public.family_recipe_shares (
  recipe_id uuid primary key references public.user_recipes(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  shared_by uuid not null references public.family_members(id) on delete cascade,
  allow_comments boolean not null default true,
  shared_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_edit_recipe(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_recipes r where r.id = rid and public.can_access_member(r.owner_member_id));
$$;

create or replace function public.can_view_recipe(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_recipes r
    where r.id = rid and (
      public.can_access_member(r.owner_member_id)
      or (public.is_family_member(r.family_id) and exists (select 1 from family_recipe_shares s where s.recipe_id = r.id and s.family_id = r.family_id))
    )
  );
$$;

create or replace function public.recipe_family(rid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from user_recipes where id = rid;
$$;

create or replace function public.is_recipe_shared(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_recipe_shares s join user_recipes r on r.id = s.recipe_id where s.recipe_id = rid and s.family_id = r.family_id);
$$;

-- A recipe always belongs to its owner's family.
create or replace function public.guard_user_recipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.family_id <> public.member_family(new.owner_member_id) then
    raise exception 'recipe family must match owner family' using errcode = '42501';
  end if;
  if new.parent_id is not null and not public.can_view_recipe(new.parent_id) then
    raise exception 'cannot derive from a recipe you cannot see' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger user_recipes_guard before insert or update on public.user_recipes
  for each row execute function public.guard_user_recipe();

-- Nutrition from food_items × grams (USDA data in the database). Deep frying adds a labelled
-- absorbed-oil estimate (8% of non-fat solids) and drops oil listed "for frying" — same rule as the app.
create or replace function public.recompute_recipe_nutrition(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  rec user_recipes%rowtype;
  t record;
  oil numeric := 0;
  missing int;
  weak int;
  conf text;
  oil_row food_items%rowtype;
begin
  select * into rec from user_recipes where id = rid;
  if not found then return; end if;
  if rec.cooking_method = 'deep_fried' then
    select coalesce(round(sum(i.grams) * 0.08), 0) into oil
    from recipe_ingredients i join food_items f on f.id = i.food_item_id
    where i.recipe_id = rid and i.grams is not null and f.category <> 'fat'
      and i.food_item_id not in ('water','milk_whole','milk_lowfat','heavy_cream','coconut_milk','soy_sauce','lemon');
    select * into oil_row from food_items where id = 'veg_oil';
  end if;
  select
    coalesce(sum(f.kcal * i.grams / 100), 0) kcal, coalesce(sum(f.protein_g * i.grams / 100), 0) p,
    coalesce(sum(f.carbs_g * i.grams / 100), 0) c, coalesce(sum(f.fat_g * i.grams / 100), 0) fat,
    coalesce(sum(f.fiber_g * i.grams / 100), 0) fib, coalesce(sum(f.sugar_g * i.grams / 100), 0) sug,
    coalesce(sum(f.sat_fat_g * i.grams / 100), 0) sat, coalesce(sum(f.sodium_mg * i.grams / 100), 0) na
  into t
  from recipe_ingredients i join food_items f on f.id = i.food_item_id
  where i.recipe_id = rid and i.grams is not null
    and not (rec.cooking_method = 'deep_fried' and i.food_item_id in ('veg_oil','olive_oil') and i.raw ~* '(قلي|fry)');
  if oil > 0 and oil_row.id is not null then
    t.kcal := t.kcal + oil_row.kcal * oil / 100; t.fat := t.fat + oil_row.fat_g * oil / 100; t.sat := t.sat + oil_row.sat_fat_g * oil / 100;
  end if;
  select count(*) filter (where (i.food_item_id is null or i.grams is null) and not (i.to_taste and coalesce(i.food_item_id, 'x') in ('salt','spices','water','parsley','lemon','x'))),
         count(*) filter (where (i.confidence <> 'high' or i.estimated) and not i.confirmed
                           and not (i.to_taste and coalesce(i.food_item_id, 'x') in ('salt','spices','water','parsley','lemon','x')))
    into missing, weak
  from recipe_ingredients i where i.recipe_id = rid;
  conf := case when missing > 0 then 'low' when weak > 0 or rec.cooking_method = 'deep_fried' then 'medium' else 'high' end;
  insert into recipe_nutrition (recipe_id, total, per_serving, per_100g, confidence, uncounted, absorbed_oil_g, computed_at)
  values (
    rid,
    jsonb_build_object('kcal', round(t.kcal, 1), 'protein', round(t.p, 1), 'carbs', round(t.c, 1), 'fat', round(t.fat, 1), 'fiber', round(t.fib, 1), 'sugar', round(t.sug, 1), 'satFat', round(t.sat, 1), 'sodium', round(t.na, 1)),
    jsonb_build_object('kcal', round(t.kcal / rec.servings, 1), 'protein', round(t.p / rec.servings, 1), 'carbs', round(t.c / rec.servings, 1), 'fat', round(t.fat / rec.servings, 1), 'fiber', round(t.fib / rec.servings, 1), 'sugar', round(t.sug / rec.servings, 1), 'satFat', round(t.sat / rec.servings, 1), 'sodium', round(t.na / rec.servings, 1)),
    case when rec.final_weight_g is null then null else jsonb_build_object('kcal', round(t.kcal * 100 / rec.final_weight_g, 1), 'protein', round(t.p * 100 / rec.final_weight_g, 1), 'carbs', round(t.c * 100 / rec.final_weight_g, 1), 'fat', round(t.fat * 100 / rec.final_weight_g, 1), 'fiber', round(t.fib * 100 / rec.final_weight_g, 1), 'sugar', round(t.sug * 100 / rec.final_weight_g, 1), 'satFat', round(t.sat * 100 / rec.final_weight_g, 1), 'sodium', round(t.na * 100 / rec.final_weight_g, 1)) end,
    conf, missing, oil, now()
  )
  on conflict (recipe_id) do update set total = excluded.total, per_serving = excluded.per_serving, per_100g = excluded.per_100g,
    confidence = excluded.confidence, uncounted = excluded.uncounted, absorbed_oil_g = excluded.absorbed_oil_g, computed_at = now();
end $$;

create or replace function public.trg_recipe_nutrition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'recipe_ingredients' then
    perform public.recompute_recipe_nutrition(coalesce(new.recipe_id, old.recipe_id));
  else
    perform public.recompute_recipe_nutrition(new.id);
  end if;
  return null;
end $$;
create trigger recipe_ingredients_nutrition after insert or update or delete on public.recipe_ingredients
  for each row execute function public.trg_recipe_nutrition();
create trigger user_recipes_nutrition after insert or update of servings, final_weight_g, cooking_method on public.user_recipes
  for each row execute function public.trg_recipe_nutrition();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fasting_profiles enable row level security;
alter table public.fasting_schedules enable row level security;
alter table public.fasting_logs enable row level security;
alter table public.fasting_badges enable row level security;
alter table public.fasting_achievements enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.user_recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_nutrition enable row level security;
alter table public.recipe_videos enable row level security;
alter table public.recipe_video_analysis enable row level security;
alter table public.healthy_substitutions enable row level security;
alter table public.favorite_recipes enable row level security;
alter table public.favorite_ingredients enable row level security;
alter table public.recipe_ratings enable row level security;
alter table public.recipe_translations enable row level security;
alter table public.recipe_documents enable row level security;
alter table public.family_recipe_shares enable row level security;

-- Fasting data is private to the member (and the guardian of a managed member).
create policy fp_all on public.fasting_profiles for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy fs_all on public.fasting_schedules for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy fl_all on public.fasting_logs for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy fb_read on public.fasting_badges for select to authenticated using (true);
create policy fa_read on public.fasting_achievements for select using (public.can_access_member(member_id));
-- (no insert/update policy on fasting_achievements: only evaluate_fasting_badges() writes them)

create policy rc_read on public.recipe_categories for select to authenticated using (member_id is null or public.can_access_member(member_id));
create policy rc_write on public.recipe_categories for all using (member_id is not null and public.can_access_member(member_id)) with check (member_id is not null and public.can_access_member(member_id));

create policy ur_read on public.user_recipes for select using (
  public.can_access_member(owner_member_id)
  or (public.is_family_member(family_id) and public.is_recipe_shared(id))
);
create policy ur_insert on public.user_recipes for insert with check (public.can_access_member(owner_member_id));
create policy ur_update on public.user_recipes for update using (public.can_access_member(owner_member_id)) with check (public.can_access_member(owner_member_id));
create policy ur_delete on public.user_recipes for delete using (public.can_access_member(owner_member_id));

create policy ri_read on public.recipe_ingredients for select using (public.can_view_recipe(recipe_id));
create policy ri_write on public.recipe_ingredients for all using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));
create policy rn_read on public.recipe_nutrition for select using (public.can_view_recipe(recipe_id));

create policy rv_all on public.recipe_videos for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));
create policy rva_all on public.recipe_video_analysis for all
  using (exists (select 1 from recipe_videos v where v.id = video_id and public.can_access_member(v.member_id)))
  with check (exists (select 1 from recipe_videos v where v.id = video_id and public.can_access_member(v.member_id)));

create policy hs_read on public.healthy_substitutions for select to authenticated using (true);

create policy fr_all on public.favorite_recipes for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and (user_recipe_id is null or public.can_view_recipe(user_recipe_id)));
create policy fi_all on public.favorite_ingredients for all using (public.can_access_member(member_id)) with check (public.can_access_member(member_id));

-- Ratings and comments are visible inside the family; each member writes only their own.
create policy rr_read on public.recipe_ratings for select using (public.is_family_member(public.member_family(member_id)));
create policy rr_write on public.recipe_ratings for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and (user_recipe_id is null or public.can_view_recipe(user_recipe_id)));

create policy rt_read on public.recipe_translations for select
  using (public.can_access_member(member_id) or (user_recipe_id is not null and public.can_view_recipe(user_recipe_id) and public.is_family_member(public.member_family(member_id))));
create policy rt_write on public.recipe_translations for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and (user_recipe_id is null or public.can_view_recipe(user_recipe_id)));
create policy rd_all on public.recipe_documents for all
  using (public.can_access_member(member_id))
  with check (public.can_access_member(member_id) and (user_recipe_id is null or public.can_view_recipe(user_recipe_id)));

create policy frs_read on public.family_recipe_shares for select using (public.is_family_member(family_id));
create policy frs_write on public.family_recipe_shares for all
  using (public.can_edit_recipe(recipe_id))
  with check (public.can_edit_recipe(recipe_id) and family_id = public.recipe_family(recipe_id) and public.can_access_member(shared_by));

grant execute on function public.evaluate_fasting_badges(uuid) to authenticated;
grant execute on function public.family_fasting_total(uuid, int, int) to authenticated;

-- Storage bucket for uploaded recipe videos/photos (private; path prefix = auth.uid()).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('recipe-media', 'recipe-media', false) on conflict (id) do nothing;
    execute $p$create policy recipe_media_own on storage.objects for all to authenticated
      using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_recipes, public.family_recipe_shares, public.recipe_ratings;
  end if;
end $$;
