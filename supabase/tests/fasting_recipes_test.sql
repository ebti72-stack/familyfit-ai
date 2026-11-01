-- Fasting + recipes: RLS, server-side badges and server-side nutrition. Runs after rls_test.sql.
\set ON_ERROR_STOP 1
reset role;
select id as mom_member from family_members where display_name = 'أم' \gset
select id as dad_member from family_members where display_name = 'أب' \gset
select id as kid from family_members where display_name = 'سارة' \gset
select family_id as fam from family_members where display_name = 'أم' \gset
set role authenticated;

-- ---------------- fasting (mom) ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into fasting_profiles (member_id, enabled, monthly_goal, join_family_challenge) values (:'mom_member', true, 3, true);
insert into fasting_schedules (member_id, fasting_type) values (:'mom_member', 'ayyam_bid');

-- a completed day must be an explicit confirmation
do $$ begin
  begin
    insert into fasting_logs (member_id, log_date, status, hijri_year, hijri_month, hijri_day)
      select id, current_date - 40, 'completed', 1448, 4, 10 from family_members where display_name = 'أم';
    raise exception 'FAIL: completed without confirmation';
  exception when check_violation then raise notice 'ok completion requires confirmation';
  end;
end $$;
-- the future cannot be completed
do $$ begin
  begin
    insert into fasting_logs (member_id, log_date, status, hijri_year, hijri_month, hijri_day, confirmed_at)
      select id, current_date + 10, 'completed', 1448, 6, 1, now() from family_members where display_name = 'أم';
    raise exception 'FAIL: future completion';
  exception when invalid_parameter_value then raise notice 'ok future completion rejected';
  end;
end $$;

-- planned days never count
insert into fasting_logs (member_id, log_date, status, hijri_year, hijri_month, hijri_day) values
  (:'mom_member', current_date - 3, 'planned', 1448, 6, 13), (:'mom_member', current_date - 2, 'planned', 1448, 6, 14), (:'mom_member', current_date - 1, 'planned', 1448, 6, 15);
select case when count(*) = 0 then 'ok planned days earn nothing' else fail() end from evaluate_fasting_badges(:'mom_member');

-- three confirmed completed days in one Hijri month → the crescent badge (+ first fast + monthly goal)
insert into fasting_logs (member_id, log_date, status, hijri_year, hijri_month, hijri_day, confirmed_at) values
  (:'mom_member', current_date - 20, 'completed', 1448, 5, 13, now()), (:'mom_member', current_date - 19, 'completed', 1448, 5, 14, now()),
  (:'mom_member', current_date - 18, 'completed', 1448, 5, 15, now());
select case when string_agg(badge_code, ',' order by badge_code) = 'first_fast,monthly_goal,three_month' then 'ok three-days badge issued' else fail() end
  from evaluate_fasting_badges(:'mom_member');
select case when count(*) = 0 then 'ok badges issued once' else fail() end from evaluate_fasting_badges(:'mom_member');
-- confirming a status back to planned clears the confirmation
update fasting_logs set status = 'planned', confirmed_at = now() where member_id = :'mom_member' and log_date = current_date - 18;
select case when confirmed_at is null then 'ok non-completed has no confirmation' else fail() end from fasting_logs where member_id = :'mom_member' and log_date = current_date - 18;
update fasting_logs set status = 'completed', confirmed_at = now() where member_id = :'mom_member' and log_date = current_date - 18;

-- badges cannot be written by clients
do $$ begin
  begin
    insert into fasting_achievements (member_id, badge_code, period_key) select id, 'ten_total', 'all' from family_members where display_name = 'أم';
    raise exception 'FAIL: direct badge insert';
  exception when insufficient_privilege then raise notice 'ok direct badge insert blocked';
  end;
end $$;

-- children: never enabled without the guardian acknowledgement
do $$ begin
  begin
    insert into fasting_profiles (member_id, enabled) select id, true from family_members where display_name = 'سارة';
    raise exception 'FAIL: child fasting without ack';
  exception when insufficient_privilege then raise notice 'ok child fasting needs guardian ack';
  end;
end $$;
insert into fasting_profiles (member_id, enabled, health_ack) values (:'kid', true, true);
select 'ok guardian can enable with ack';

-- ---------------- fasting (dad: same family, different adult) ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select case when (select count(*) from fasting_logs) + (select count(*) from fasting_profiles) + (select count(*) from fasting_achievements) = 0
  then 'ok dad cannot read mom fasting data' else fail() end;
do $$ begin
  begin
    perform evaluate_fasting_badges((select id from family_members where display_name = 'أم'));
    raise exception 'FAIL: evaluate for others';
  exception when insufficient_privilege then raise notice 'ok badges for others forbidden';
  end;
end $$;
-- the family challenge is an anonymous total only
select case when participants = 1 and completed_days = 3 then 'ok family fasting total' else fail() end from family_fasting_total(:'fam', 1448, 5);

-- ---------------- recipes ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into user_recipes (family_id, owner_member_id, title, servings, source_kind) values (:'fam', :'mom_member', 'أرز بالدجاج', 4, 'text') returning id as rid \gset
insert into recipe_ingredients (recipe_id, position, raw, name, food_item_id, grams, confidence) values
  (:'rid', 0, '500 غ دجاج', 'دجاج', 'chicken_raw', 500, 'high'),
  (:'rid', 1, '200 غ أرز', 'أرز', 'rice_white_dry', 200, 'high'),
  (:'rid', 2, 'ملح حسب الرغبة', 'ملح', 'salt', null, 'medium');
update recipe_ingredients set to_taste = true where recipe_id = :'rid' and position = 2;
-- (120×5 + 365×2) / 4 = 332.5 kcal per serving, computed in the database from food_items
select case when (per_serving->>'kcal')::numeric = 332.5 and confidence = 'high' then 'ok server-side recipe nutrition' else fail() end from recipe_nutrition where recipe_id = :'rid';
update user_recipes set cooking_method = 'deep_fried' where id = :'rid';
select case when absorbed_oil_g = 56 and confidence = 'medium' then 'ok deep-fry absorbed oil estimate' else fail() end from recipe_nutrition where recipe_id = :'rid';
insert into recipe_ingredients (recipe_id, position, raw, name, food_item_id, grams, confidence) values (:'rid', 3, 'صلصة غريبة', 'صلصة', null, null, 'low');
select case when confidence = 'low' and uncounted = 1 then 'ok unknown ingredient lowers confidence' else fail() end from recipe_nutrition where recipe_id = :'rid';
do $$ begin
  begin
    update recipe_nutrition set per_serving = '{"kcal":1}';
    if found then raise exception 'FAIL: client changed nutrition'; end if;
    raise notice 'ok nutrition not writable by clients';
  exception when insufficient_privilege then raise notice 'ok nutrition not writable by clients';
  end;
end $$;
-- improved version must point to a visible parent
insert into user_recipes (family_id, owner_member_id, title, parent_id, version_kind) values (:'fam', :'mom_member', 'أرز بالدجاج (نسخة محسّنة)', :'rid', 'improved');
select 'ok improved version linked';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select case when (select count(*) from user_recipes) + (select count(*) from recipe_ingredients) + (select count(*) from recipe_nutrition) = 0
  then 'ok private recipe hidden from family' else fail() end;
do $$ begin
  begin
    insert into user_recipes (family_id, owner_member_id, title) select family_id, id, 'x' from family_members where display_name = 'أم';
    raise exception 'FAIL: recipe for another adult';
  exception when insufficient_privilege then raise notice 'ok cannot create recipe as someone else';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into family_recipe_shares (recipe_id, family_id, shared_by) values (:'rid', :'fam', :'mom_member');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select case when count(*) = 1 then 'ok shared recipe visible to family' else fail() end from user_recipes;
select case when count(*) = 4 then 'ok shared ingredients visible' else fail() end from recipe_ingredients;
insert into recipe_ratings (member_id, user_recipe_id, stars, comment) values (:'dad_member', :'rid', 5, 'لذيذة');
insert into favorite_recipes (member_id, user_recipe_id, folders) values (:'dad_member', :'rid', '{family,lunch}');
insert into favorite_ingredients (member_id, food_item_id) values (:'dad_member', 'salmon');
insert into recipe_translations (member_id, user_recipe_id, lang, title, ingredient_names, steps) values (:'dad_member', :'rid', 'fil', 'Kanin na may manok', '{Manok,Bigas,Asin,Sarsa}', '{}');
update user_recipes set title = 'hacked' where id = :'rid';
select case when title = 'أرز بالدجاج' then 'ok family cannot edit owner recipe' else fail() end from user_recipes where id = :'rid';
do $$ begin
  begin
    insert into recipe_ratings (member_id, builtin_recipe_id, stars) select id, 'oats_berries', 5 from family_members where display_name = 'أم';
    raise exception 'FAIL: rating as someone else';
  exception when insufficient_privilege then raise notice 'ok cannot rate as someone else';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select case when count(*) = 1 then 'ok owner sees family rating' else fail() end from recipe_ratings;
select case when count(*) = 0 then 'ok favourites are private' else fail() end from favorite_recipes;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select case when (select count(*) from user_recipes) + (select count(*) from recipe_ratings) + (select count(*) from family_recipe_shares) + (select count(*) from recipe_translations) = 0
  then 'ok outsider sees no recipes' else fail() end;
select case when count(*) = 0 then 'ok outsider gets no fasting total' else fail() end from family_fasting_total(:'fam', 1448, 5);
select case when count(*) = 22 then 'ok substitutions reference readable' else fail() end from healthy_substitutions;
reset role;
select 'ALL FASTING & RECIPE TESTS PASSED';
