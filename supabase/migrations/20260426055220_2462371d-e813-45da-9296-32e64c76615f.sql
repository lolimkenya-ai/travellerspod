-- 1) Rebrand the official profile to Safiripod (only if a profile is set as the official one).
update public.profiles
set nametag = 'safiripod', display_name = 'Safiripod'
where id = (select value::uuid from public.app_settings where key = 'official_profile_id')
  and nametag <> 'safiripod';

-- 2) Verification documents: rejection / review reason
alter table public.verification_documents
  add column if not exists review_message text;

-- 3) Atomic admin decision RPC (approve / reject with reason / pending)
create or replace function public.decide_verification(
  _profile uuid,
  _decision text,         -- 'verified' | 'unverified' | 'pending'
  _reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare _new public.verification_status;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Admins only';
  end if;
  if _decision not in ('verified','unverified','pending') then
    raise exception 'Invalid decision';
  end if;

  _new := _decision::public.verification_status;

  update public.profiles set verification_status = _new where id = _profile;

  -- If rejected (sent back to unverified) with a reason, drop a message
  -- the owner will see in their verification thread.
  if _decision = 'unverified' and _reason is not null and length(btrim(_reason)) > 0 then
    insert into public.verification_messages (profile_id, author_id, body)
    values (_profile, auth.uid(), _reason);
  end if;

  perform public.log_audit(
    'verification_' || _decision,
    'profile',
    _profile::text,
    jsonb_build_object('reason', _reason)
  );
end;
$$;

-- 4) Tighten audit log reads to super_admin only (most sensitive surface).
drop policy if exists "admins read audit logs" on public.audit_logs;
create policy "super admins read audit logs"
  on public.audit_logs for select
  using (public.has_role(auth.uid(), 'super_admin'));

-- 5) Index to speed up profile post listings.
create index if not exists idx_posts_author_created
  on public.posts (author_id, created_at desc);

-- 6) Conversations / messages rate-limit safety:
--    Cap number of new conversations + messages per user per minute via trigger.
create or replace function public.guard_message_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_rate_limit('send_message', 30, 60);
  return new;
end;
$$;
drop trigger if exists trg_messages_rate on public.messages;
create trigger trg_messages_rate
  before insert on public.messages
  for each row execute function public.guard_message_rate();

create or replace function public.guard_follow_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_rate_limit('follow_action', 60, 60);
  return new;
end;
$$;
drop trigger if exists trg_follows_rate on public.follows;
create trigger trg_follows_rate
  before insert on public.follows
  for each row execute function public.guard_follow_rate();