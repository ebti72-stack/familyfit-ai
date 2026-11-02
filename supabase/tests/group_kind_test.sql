-- Personal use vs groups (family / friends).
\set ON_ERROR_STOP 1
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select family_id as solo from create_family('سارة', 'سارة', null, 'personal') \gset
select invite_code as solo_code from families where id = :'solo' \gset
select case when kind = 'personal' then 'ok personal space created' else fail() end from families where id = :'solo';

-- nobody can join a personal space by its code
select set_config('ff.code', :'solo_code', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    perform join_family((select current_setting('ff.code')), 'x');
    raise exception 'FAIL: joined personal';
  exception when no_data_found then raise notice 'ok personal space not joinable';
  end;
end $$;

-- the owner turns it into a friends group → joinable, but no supervised children
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update families set kind = 'friends', name = 'صديقات المشي' where id = :'solo';
do $$ begin
  begin
    insert into family_members (family_id, display_name, role, managed_by)
      select id, 'طفل', 'child', auth.uid() from families where name = 'صديقات المشي';
    raise exception 'FAIL: child in friends group';
  exception when insufficient_privilege then raise notice 'ok no supervised members in friends groups';
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select case when family_id = :'solo' then 'ok friend joined group' else fail() end from join_family(:'solo_code', 'صديقة');
reset role;
select 'ALL GROUP KIND TESTS PASSED';
