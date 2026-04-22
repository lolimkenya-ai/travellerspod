-- 1. App settings table
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read"
  on public.app_settings for select using (true);

drop policy if exists "admins manage app_settings" on public.app_settings;
create policy "admins manage app_settings"
  on public.app_settings for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Seed official travelpod account
do $$
declare
  tp_id uuid;
begin
  -- Temporarily lift the verification guard for this seed
  set local session_replication_role = replica;

  select id into tp_id from public.profiles where nametag = 'travelpod';

  if tp_id is null then
    select id into tp_id from auth.users where email = 'official@travelpod.system';

    if tp_id is null then
      tp_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        tp_id,
        'authenticated',
        'authenticated',
        'official@travelpod.system',
        crypt(gen_random_uuid()::text, gen_salt('bf')),
        now(),
        '{"provider":"system","providers":["system"]}'::jsonb,
        jsonb_build_object('display_name','travelpod','nametag','travelpod','account_type','organization'),
        now(), now(), '', '', '', ''
      );
    end if;

    insert into public.profiles (id, nametag, display_name, account_type, verification_status, verified, bio)
    values (tp_id, 'travelpod', 'travelpod', 'organization', 'verified', true,
            'The official travelpod account. Welcome to the community ✈️')
    on conflict (id) do update set
      nametag = 'travelpod',
      display_name = 'travelpod',
      account_type = 'organization',
      verification_status = 'verified',
      verified = true;
  end if;

  insert into public.app_settings (key, value) values ('official_profile_id', tp_id::text)
    on conflict (key) do update set value = excluded.value;
end $$;

-- 3. Update handle_new_user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_tag text;
  candidate text;
  n int := 0;
  tp_id uuid;
begin
  base_tag := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'nametag',
                                            split_part(new.email, '@', 1),
                                            'user'),
                                   '[^a-z0-9_.]', '', 'g'));
  if char_length(base_tag) < 3 then
    base_tag := base_tag || 'user';
  end if;
  base_tag := substr(base_tag, 1, 24);
  candidate := base_tag;
  while exists(select 1 from public.profiles where nametag = candidate) loop
    n := n + 1;
    candidate := substr(base_tag, 1, 24) || n::text;
  end loop;

  insert into public.profiles (id, nametag, display_name, avatar_url, account_type)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'display_name',
             new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             candidate),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'account_type')::public.account_type, 'personal')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
    on conflict do nothing;

  select value::uuid into tp_id from public.app_settings where key = 'official_profile_id';
  if tp_id is not null and tp_id <> new.id then
    insert into public.follows (follower_id, followee_id)
    values (new.id, tp_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- 4. Prevent self-follow
create or replace function public.prevent_self_follow()
returns trigger
language plpgsql
as $$
begin
  if new.follower_id = new.followee_id then
    raise exception 'You cannot follow yourself';
  end if;
  return new;
end; $$;

drop trigger if exists prevent_self_follow on public.follows;
create trigger prevent_self_follow
  before insert on public.follows
  for each row execute function public.prevent_self_follow();

-- 5. Backfill auto-follow
do $$
declare
  tp_id uuid;
begin
  select value::uuid into tp_id from public.app_settings where key = 'official_profile_id';
  if tp_id is not null then
    insert into public.follows (follower_id, followee_id)
    select p.id, tp_id from public.profiles p
    where p.id <> tp_id
    on conflict do nothing;
  end if;
end $$;
