
-- =========================================================
-- 1. Private app_secrets (server-only) for the super-admin email
-- =========================================================
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;

drop policy if exists "super_admin reads app_secrets" on public.app_secrets;
create policy "super_admin reads app_secrets"
on public.app_secrets for select
using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "super_admin manages app_secrets" on public.app_secrets;
create policy "super_admin manages app_secrets"
on public.app_secrets for all
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

insert into public.app_secrets (key, value) values
  ('super_admin_email', 'waithakateddy045@gmail.com')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- =========================================================
-- 2. Immutable audit log
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_addr text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "admins read audit logs" on public.audit_logs;
create policy "admins read audit logs"
on public.audit_logs for select
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

create or replace function public.deny_audit_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit_logs is immutable'; end; $$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.deny_audit_mutation();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.deny_audit_mutation();

create or replace function public.log_audit(
  _action text,
  _entity_type text default null,
  _entity_id text default null,
  _metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare _email text;
begin
  if auth.uid() is null then return; end if;
  select email into _email from auth.users where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
  values (auth.uid(), _email, _action, _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb));
end; $$;

-- =========================================================
-- 3. Rate limits
-- =========================================================
create table if not exists public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  _action text, _max int, _window_seconds int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _bucket timestamptz;
  _count int;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  _bucket := date_trunc('second', now())
    - (extract(epoch from now())::int % _window_seconds) * interval '1 second';

  insert into public.rate_limits (user_id, action, window_start, count)
  values (_uid, _action, _bucket, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into _count;

  if _count > _max then
    perform public.log_audit('rate_limit_hit', 'action', _action,
      jsonb_build_object('count', _count, 'max', _max, 'window_seconds', _window_seconds));
    raise exception 'Rate limit exceeded for % (% per % seconds)',
      _action, _max, _window_seconds using errcode = 'P0001';
  end if;
  return true;
end; $$;

create or replace function public.gc_rate_limits() returns void
language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

-- =========================================================
-- 4. Auto-grant super_admin on signup AND on demand
-- =========================================================
create or replace function public.maybe_grant_super_admin(_user_id uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare _target text;
begin
  select value into _target from public.app_secrets where key = 'super_admin_email';
  if _target is null or _email is null then return; end if;
  if lower(_email) = lower(_target) then
    insert into public.user_roles (user_id, role) values (_user_id, 'super_admin')
      on conflict (user_id, role) do nothing;
    insert into public.user_roles (user_id, role) values (_user_id, 'admin')
      on conflict (user_id, role) do nothing;
  end if;
end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_tag text; candidate text; n int := 0; tp_id uuid;
begin
  base_tag := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'nametag',
                                            split_part(new.email, '@', 1), 'user'),
                                   '[^a-z0-9_.]', '', 'g'));
  if char_length(base_tag) < 3 then base_tag := base_tag || 'user'; end if;
  base_tag := substr(base_tag, 1, 24);
  candidate := base_tag;
  while exists(select 1 from public.profiles where nametag = candidate) loop
    n := n + 1; candidate := substr(base_tag, 1, 24) || n::text;
  end loop;

  insert into public.profiles (id, nametag, display_name, avatar_url, account_type)
  values (new.id, candidate,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name', candidate),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'account_type')::public.account_type, 'personal')
  ) on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  perform public.maybe_grant_super_admin(new.id, new.email);

  select value::uuid into tp_id from public.app_settings where key = 'official_profile_id';
  if tp_id is not null and tp_id <> new.id then
    insert into public.follows (follower_id, followee_id) values (new.id, tp_id) on conflict do nothing;
  end if;
  return new;
end; $$;

create or replace function public.ensure_super_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare _email text;
begin
  if auth.uid() is null then return false; end if;
  select email into _email from auth.users where id = auth.uid();
  perform public.maybe_grant_super_admin(auth.uid(), _email);
  return exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin');
end; $$;

-- Backfill if super-admin email already signed up
do $$
declare _target text; _uid uuid; _email text;
begin
  select value into _target from public.app_secrets where key = 'super_admin_email';
  if _target is not null then
    for _uid, _email in select id, email from auth.users where lower(email) = lower(_target) loop
      perform public.maybe_grant_super_admin(_uid, _email);
    end loop;
  end if;
end $$;

-- =========================================================
-- 5. business_members
-- =========================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'business_role') then
    create type public.business_role as enum ('owner', 'manager', 'editor');
  end if;
end $$;

create table if not exists public.business_members (
  business_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.business_role not null default 'editor',
  added_by uuid,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.business_members enable row level security;

create or replace function public.is_business_member(_business uuid, _user uuid, _min_role public.business_role default 'editor')
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.business_members
    where business_id = _business and user_id = _user
      and case _min_role
            when 'editor' then true
            when 'manager' then role in ('manager','owner')
            when 'owner' then role = 'owner'
          end
  )
$$;

drop policy if exists "members read team" on public.business_members;
create policy "members read team" on public.business_members for select
using (user_id = auth.uid() or business_id = auth.uid()
  or public.is_business_member(business_id, auth.uid(), 'editor')
  or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "owner manages team" on public.business_members;
create policy "owner manages team" on public.business_members for all
using (business_id = auth.uid()
  or public.is_business_member(business_id, auth.uid(), 'owner')
  or public.has_role(auth.uid(), 'super_admin'))
with check (business_id = auth.uid()
  or public.is_business_member(business_id, auth.uid(), 'owner')
  or public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 6. user_blocks
-- =========================================================
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "users read own blocks" on public.user_blocks;
create policy "users read own blocks" on public.user_blocks for select
using (auth.uid() = blocker_id);

drop policy if exists "users add own blocks" on public.user_blocks;
create policy "users add own blocks" on public.user_blocks for insert
with check (auth.uid() = blocker_id);

drop policy if exists "users remove own blocks" on public.user_blocks;
create policy "users remove own blocks" on public.user_blocks for delete
using (auth.uid() = blocker_id);

create or replace function public.is_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.user_blocks
    where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a)
  )
$$;

create or replace function public.guard_follow_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.follower_id, new.followee_id) then
    raise exception 'You cannot follow this user';
  end if;
  return new;
end; $$;

drop trigger if exists follows_block_guard on public.follows;
create trigger follows_block_guard before insert on public.follows
  for each row execute function public.guard_follow_block();

create or replace function public.guard_comment_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.posts where id = new.post_id;
  if _author is not null and public.is_blocked(new.author_id, _author) then
    raise exception 'You cannot comment on this post';
  end if;
  return new;
end; $$;

drop trigger if exists post_comments_block_guard on public.post_comments;
create trigger post_comments_block_guard before insert on public.post_comments
  for each row execute function public.guard_comment_block();

create or replace function public.guard_message_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare _other uuid;
begin
  for _other in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.author_id
  loop
    if public.is_blocked(new.author_id, _other) then
      raise exception 'You cannot message this user';
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists messages_block_guard on public.messages;
create trigger messages_block_guard before insert on public.messages
  for each row execute function public.guard_message_block();

-- =========================================================
-- 7. user_settings
-- =========================================================
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  private_account boolean not null default false,
  dm_policy text not null default 'everyone' check (dm_policy in ('everyone','followers','none')),
  comment_policy text not null default 'everyone' check (comment_policy in ('everyone','followers','none')),
  notify_likes boolean not null default true,
  notify_comments boolean not null default true,
  notify_follows boolean not null default true,
  notify_reposts boolean not null default true,
  notify_inquiries boolean not null default true,
  notify_broadcasts boolean not null default true,
  email_optin boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "owner reads own settings" on public.user_settings;
create policy "owner reads own settings" on public.user_settings for select
using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "owner upserts own settings" on public.user_settings;
create policy "owner upserts own settings" on public.user_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "owner updates own settings" on public.user_settings;
create policy "owner updates own settings" on public.user_settings for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- =========================================================
-- 8. Account deletion
-- =========================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  perform public.log_audit('delete_account', 'user', _uid::text, '{}'::jsonb);
  delete from public.profiles where id = _uid;
  begin delete from auth.users where id = _uid;
  exception when others then null; end;
end; $$;

-- =========================================================
-- 9. Audit triggers for sensitive admin actions
-- =========================================================
create or replace function public.audit_verification_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    perform public.log_audit('verification_change', 'profile', new.id::text,
      jsonb_build_object('from', old.verification_status, 'to', new.verification_status));
  end if;
  return new;
end; $$;

drop trigger if exists profiles_audit_verification on public.profiles;
create trigger profiles_audit_verification after update on public.profiles
  for each row execute function public.audit_verification_change();

create or replace function public.audit_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('role_grant', 'user', new.user_id::text,
      jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform public.log_audit('role_revoke', 'user', old.user_id::text,
      jsonb_build_object('role', old.role));
  end if;
  return null;
end; $$;

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_role_change();
