-- =========================================================
-- 1. Business details: protect sensitive contact fields
-- =========================================================

-- Drop the overly-permissive public read policy
drop policy if exists "business details are public" on public.business_details;

-- Owner can always read their own row
create policy "owner reads own business details"
  on public.business_details for select
  using (auth.uid() = profile_id);

-- Admins can read any
create policy "admins read business details"
  on public.business_details for select
  using (public.has_role(auth.uid(), 'admin'));

-- Public read only when business is verified
create policy "public reads verified business details"
  on public.business_details for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = business_details.profile_id
        and p.verification_status = 'verified'
    )
  );

-- Public-safe view for unverified businesses (excludes contact + registration)
create or replace view public.business_details_public as
  select
    profile_id,
    category,
    category_slug,
    associations,
    country,
    website,
    instagram,
    twitter,
    linkedin,
    facebook,
    tiktok,
    youtube,
    updated_at
  from public.business_details;

grant select on public.business_details_public to anon, authenticated;

-- =========================================================
-- 2. Profiles: hide internal moderation columns from the public
-- =========================================================
revoke select (flagged_danger, danger_reason) on public.profiles from anon, authenticated;
-- service_role keeps access; admins read via SECURITY DEFINER helpers.

create or replace function public.get_profile_moderation(_profile uuid)
returns table (flagged_danger boolean, danger_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select p.flagged_danger, p.danger_reason
  from public.profiles p
  where p.id = _profile
    and public.has_role(auth.uid(), 'admin')
$$;

revoke execute on function public.get_profile_moderation(uuid) from public, anon;
grant execute on function public.get_profile_moderation(uuid) to authenticated;

-- =========================================================
-- 3. user_roles: prevent admins from granting super_admin
-- =========================================================
drop policy if exists "admins manage roles" on public.user_roles;

-- Admins can manage non-super_admin roles only
create policy "admins manage non-super roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin') and role <> 'super_admin')
  with check (public.has_role(auth.uid(), 'admin') and role <> 'super_admin');

-- Super-admins manage all roles, including super_admin
create policy "super_admin manages all roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 4. Official Safiripod compose: super-admin only RPC
-- =========================================================
create or replace function public.post_as_official(
  _caption text,
  _location text default null,
  _category_slug text default null,
  _text_background text default null,
  _text_foreground text default null,
  _is_broadcast boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _official uuid;
        _new_id uuid;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Super-admins only';
  end if;
  if _caption is null or length(btrim(_caption)) = 0 then
    raise exception 'Caption required';
  end if;
  select value::uuid into _official from public.app_settings where key = 'official_profile_id';
  if _official is null then
    raise exception 'Official profile not configured';
  end if;
  insert into public.posts (
    author_id, media_type, caption, location, category_slug,
    text_background, text_foreground, is_broadcast
  ) values (
    _official, 'text', left(_caption, 2000),
    nullif(btrim(_location), ''), nullif(_category_slug, ''),
    _text_background, _text_foreground,
    coalesce(_is_broadcast, false)
  ) returning id into _new_id;

  perform public.log_audit('post_as_official', 'post', _new_id::text,
    jsonb_build_object('broadcast', _is_broadcast));
  return _new_id;
end;
$$;

revoke execute on function public.post_as_official(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.post_as_official(text, text, text, text, text, boolean) to authenticated;

-- =========================================================
-- 5. Lock down log_audit (internal-only)
-- =========================================================
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;

-- =========================================================
-- 6. Lock down internal helpers from anon/authenticated
-- =========================================================
revoke execute on function public.maybe_grant_super_admin(uuid, text) from public, anon, authenticated;
revoke execute on function public.gc_rate_limits() from public, anon, authenticated;
revoke execute on function public.deny_audit_mutation() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_follow_change() from public, anon, authenticated;
revoke execute on function public.bump_post_likes() from public, anon, authenticated;
revoke execute on function public.bump_post_comments() from public, anon, authenticated;
revoke execute on function public.bump_post_saves() from public, anon, authenticated;
revoke execute on function public.bump_conversation_last() from public, anon, authenticated;
revoke execute on function public.notify_on_like() from public, anon, authenticated;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;
revoke execute on function public.notify_on_follow() from public, anon, authenticated;
revoke execute on function public.notify_on_message() from public, anon, authenticated;
revoke execute on function public.notify_on_repost() from public, anon, authenticated;
revoke execute on function public.notify_on_inquiry() from public, anon, authenticated;
revoke execute on function public.guard_post_flags() from public, anon, authenticated;
revoke execute on function public.guard_verified_flag() from public, anon, authenticated;
revoke execute on function public.guard_follow_block() from public, anon, authenticated;
revoke execute on function public.guard_follow_rate() from public, anon, authenticated;
revoke execute on function public.guard_message_block() from public, anon, authenticated;
revoke execute on function public.guard_message_rate() from public, anon, authenticated;
revoke execute on function public.guard_comment_block() from public, anon, authenticated;
revoke execute on function public.prevent_self_follow() from public, anon, authenticated;
revoke execute on function public.audit_role_change() from public, anon, authenticated;
revoke execute on function public.audit_verification_change() from public, anon, authenticated;
revoke execute on function public.sync_verified_flag() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.is_business_member(uuid, uuid, business_role) from public, anon;
revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
-- check_rate_limit is meant to be called from triggers only
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- =========================================================
-- 7. Realtime: restrict channel subscriptions to own data
-- =========================================================
alter table if exists realtime.messages enable row level security;

drop policy if exists "users subscribe to own realtime topics" on realtime.messages;
create policy "users subscribe to own realtime topics"
  on realtime.messages for select
  to authenticated
  using (
    -- Allow only postgres_changes payloads — these come from RLS-enforced
    -- table reads, so each user only sees rows their own RLS allows.
    extension = 'postgres_changes'
    or
    -- For broadcast/presence, scope topic to the user's own uuid prefix.
    (extension in ('broadcast','presence')
     and topic like (auth.uid()::text || ':%'))
  );
