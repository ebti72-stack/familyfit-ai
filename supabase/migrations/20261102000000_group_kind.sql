-- Personal use or a group (family or friends). The app is not limited to families.
alter table public.families add column kind text not null default 'family' check (kind in ('personal', 'family', 'friends'));

drop function if exists public.create_family(text, text, text);
create or replace function public.create_family(family_name text, my_name text, my_emoji text default null, group_kind text default 'family')
returns public.family_members language plpgsql security definer set search_path = public as $$
declare f families; m family_members;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if group_kind not in ('personal', 'family', 'friends') then raise exception 'invalid group kind' using errcode = '22023'; end if;
  insert into families (name, created_by, kind) values (family_name, auth.uid(), group_kind) returning * into f;
  insert into family_members (family_id, user_id, display_name, avatar_emoji, role)
  values (f.id, auth.uid(), my_name, my_emoji, 'admin') returning * into m;
  return m;
end $$;
grant execute on function public.create_family(text, text, text, text) to authenticated;

-- A personal space cannot be joined by code (it becomes joinable once the owner turns it into a group).
create or replace function public.join_family(code text, my_name text, my_role member_role default 'adult', my_emoji text default null)
returns public.family_members language plpgsql security definer set search_path = public as $$
declare f families; m family_members;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if my_role = 'admin' then my_role := 'adult'; end if;
  select * into f from families where invite_code = upper(trim(code)) and kind <> 'personal';
  if not found then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into family_members (family_id, user_id, display_name, avatar_emoji, role)
  values (f.id, auth.uid(), my_name, my_emoji, my_role)
  on conflict (family_id, user_id) do update set display_name = excluded.display_name
  returning * into m;
  return m;
end $$;

-- Supervised members (children without an account) exist only in family groups.
create or replace function public.guard_managed_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and (select kind from families where id = new.family_id) <> 'family' then
    raise exception 'supervised members are only available in family groups' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger family_members_guard_managed before insert on public.family_members for each row execute function public.guard_managed_member();

-- A group that already has supervised children stays a family group.
create or replace function public.guard_group_kind() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'family' and exists (select 1 from family_members where family_id = new.id and user_id is null) then
    raise exception 'this group has supervised members' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger families_guard_kind before update of kind on public.families for each row execute function public.guard_group_kind();
