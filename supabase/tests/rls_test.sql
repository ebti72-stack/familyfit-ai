-- RLS isolation tests. Run after auth_stub.sql + migrations. Fails loudly on any violation.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a', 'mom@a.test'),
 ('00000000-0000-0000-0000-00000000000b', 'dad@a.test'),
 ('00000000-0000-0000-0000-00000000000c', 'other@b.test');

create function fail() returns text language plpgsql as $$ begin raise exception 'TEST FAILED'; end $$;
grant execute on function fail() to authenticated;
set role authenticated;
-- Mom creates family A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select id as mom_member from create_family('عائلة أ', 'أم') \gset
select invite_code from families \gset
-- Mom adds a managed child
insert into family_members (family_id, display_name, role, managed_by, parental_consent_at)
  select family_id, 'سارة', 'child', auth.uid(), now() from family_members where id = :'mom_member' returning id as kid \gset
insert into health_profiles (member_id, birth_date, sex, height_cm) values (:'kid', '2018-05-01', 'female', 125);
insert into health_profiles (member_id, birth_date, sex, height_cm, weight_kg) values (:'mom_member', '1988-02-01', 'female', 163, 64);
insert into daily_goals (member_id, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g_max, sat_fat_g_max, sodium_mg_max, water_ml)
  values (:'mom_member', 1900, 95, 230, 63, 27, 47, 21, 2300, 500);
insert into hydration_logs (member_id, family_id, log_date, ml) select :'mom_member', family_id, current_date, 500 from family_members where id = :'mom_member';
select award_habit_points(:'mom_member', current_date, 'water_goal') as pts \gset
select case when :pts = 10 then 'ok water points' else fail() end;
-- idempotent: second award inserts nothing and returns 0
select case when award_habit_points(:'mom_member', current_date, 'water_goal') = 0 then 'ok second award 0' else fail() end;
select case when count(*) = 1 then 'ok idempotent points' else fail() end from leaderboard_points;
-- meal points fail without a meal
select case when award_habit_points(:'mom_member', current_date, 'meal_logged') = 0 then 'ok no meal no points' else fail() end;

-- Dad joins with the code
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select id as dad_member from join_family(:'invite_code', 'أب') \gset
select case when count(*) = 3 then 'ok dad sees 3 members' else fail() end from family_members;
select case when count(*) = 0 then 'ok dad cannot read mom health profile' else fail() end from health_profiles;
select case when count(*) = 0 then 'ok dad cannot read mom water' else fail() end from hydration_logs;
select case when count(*) = 1 then 'ok dad sees family points' else fail() end from leaderboard_points;
select case when (select points from family_leaderboard((select family_id from family_members where id = :'dad_member'), current_date, current_date) where display_name = 'أم') = 10 then 'ok leaderboard' else fail() end;
-- dad cannot write points directly
do $$ begin
  begin
    insert into leaderboard_points (family_id, member_id, log_date, reason, points) select family_id, id, current_date, 'x', 999 from family_members limit 1;
    raise exception 'FAIL: direct points insert allowed';
  exception when insufficient_privilege then raise notice 'ok direct points insert blocked';
  end;
end $$;
-- dad cannot log water for mom
do $$ begin
  begin
    insert into hydration_logs (member_id, family_id, log_date, ml) select id, family_id, current_date, 250 from family_members where display_name = 'أم';
    raise exception 'FAIL: logging for another adult allowed';
  exception when insufficient_privilege then raise notice 'ok cannot log for another adult';
  end;
end $$;
-- dad (not admin) cannot award points to mom
do $$ begin
  begin
    perform award_habit_points((select id from family_members where display_name = 'أم'), current_date, 'water_goal');
    raise exception 'FAIL';
  exception when raise_exception then
    if sqlerrm = 'FAIL' then raise; end if;
    raise notice 'ok award for others forbidden';
  end;
end $$;

-- Outsider sees nothing
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select case when (select count(*) from families) + (select count(*) from family_members) + (select count(*) from leaderboard_points) + (select count(*) from health_profiles) = 0
  then 'ok outsider isolated' else fail() end;
select case when count(*) = 0 then 'ok outsider leaderboard empty' else fail() end
  from family_leaderboard((select family_id from family_members limit 1), current_date, current_date);

-- Mom (admin) can read the managed child's profile but meal_items totals stay consistent
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select case when count(*) = 2 then 'ok admin sees own + child profile' else fail() end from health_profiles;
insert into food_logs (member_id, family_id, log_date, meal_type, title, source, dedupe_key)
  select :'mom_member', family_id, current_date, 'lunch', 'غداء', 'manual', 'k1' from family_members where id = :'mom_member' returning id as log \gset
insert into meal_items (food_log_id, name, grams, kcal, protein_g, carbs_g, fat_g) values (:'log', 'دجاج', 150, 248, 46, 0, 5.4), (:'log', 'رز', 150, 195, 4, 42, 0.4);
select case when kcal = 443 and protein_g = 50 then 'ok totals trigger' else fail() end from food_logs where id = :'log';
do $$ begin
  begin
    insert into food_logs (member_id, family_id, log_date, meal_type, title, source, dedupe_key)
      select member_id, family_id, log_date, meal_type, title, source, dedupe_key from food_logs limit 1;
    raise exception 'FAIL dedupe';
  exception when unique_violation then raise notice 'ok duplicate meal rejected';
  end;
end $$;
select case when award_habit_points(:'mom_member', current_date, 'meal_logged') = 10 then 'ok meal points' else fail() end;
reset role;
select 'ALL RLS TESTS PASSED';
