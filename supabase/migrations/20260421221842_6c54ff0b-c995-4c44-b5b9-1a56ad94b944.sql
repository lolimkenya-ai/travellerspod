-- ENUMS
create type public.account_type as enum ('personal', 'business', 'organization');
create type public.app_role as enum ('admin', 'user');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nametag text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  account_type public.account_type not null default 'personal',
  verified boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nametag_format check (nametag ~ '^[a-z0-9_.]{3,30}$'),
  constraint display_name_length check (char_length(display_name) between 1 and 60),
  constraint bio_length check (bio is null or char_length(bio) <= 280)
);

-- BUSINESS DETAILS
create table public.business_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  category text,
  associations text,
  registration_number text,
  address text,
  country text,
  contact_email text,
  contact_phone text,
  website text,
  instagram text,
  twitter text,
  linkedin text,
  facebook text,
  tiktok text,
  youtube text,
  updated_at timestamptz not null default now()
);

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows(followee_id);

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- ROLE HELPER (security definer to avoid recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- AUTO-CREATE PROFILE ON SIGNUP
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
  );

  -- default role
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- UPDATED_AT TRIGGERS
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger business_details_touch before update on public.business_details
for each row execute function public.touch_updated_at();

-- FOLLOWS COUNT MAINTENANCE
create or replace function public.handle_follow_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
  return null;
end; $$;

create trigger follows_count_trg
after insert or delete on public.follows
for each row execute function public.handle_follow_change();

-- PREVENT NON-ADMINS FROM TOGGLING verified
create or replace function public.guard_verified_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified is distinct from old.verified
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can change verified status';
  end if;
  return new;
end; $$;

create trigger profiles_guard_verified
before update on public.profiles
for each row execute function public.guard_verified_flag();

-- RLS
alter table public.profiles enable row level security;
alter table public.business_details enable row level security;
alter table public.follows enable row level security;
alter table public.user_roles enable row level security;

-- profiles policies
create policy "profiles are public"
  on public.profiles for select
  using (true);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- business_details policies
create policy "business details are public"
  on public.business_details for select
  using (true);

create policy "owner can insert own business details"
  on public.business_details for insert
  with check (auth.uid() = profile_id);

create policy "owner can update own business details"
  on public.business_details for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "owner can delete own business details"
  on public.business_details for delete
  using (auth.uid() = profile_id);

-- follows policies
create policy "follows are public"
  on public.follows for select
  using (true);

create policy "users can follow as themselves"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "users can unfollow as themselves"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- user_roles policies (admin-only management; users can read their own roles)
create policy "users read own roles"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));