-- =========================================================================
-- ENUMS
-- =========================================================================
create type public.media_type as enum ('video', 'image', 'text');
create type public.verification_status as enum ('unverified', 'pending', 'verified');
create type public.notification_type as enum ('like', 'comment', 'follow', 'repost', 'inquiry', 'verified');

-- =========================================================================
-- PROFILE EXTENSIONS
-- =========================================================================
alter table public.profiles
  add column if not exists verification_status public.verification_status not null default 'unverified',
  add column if not exists settings_completed boolean not null default false;

-- Sync the legacy `verified` boolean with verification_status.
create or replace function public.sync_verified_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified := (new.verification_status = 'verified');
  return new;
end; $$;

create trigger profiles_sync_verified
before insert or update on public.profiles
for each row execute function public.sync_verified_flag();

-- Replace the old guard so non-admins can SUBMIT (unverified -> pending) but not approve.
create or replace function public.guard_verified_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if public.has_role(auth.uid(), 'admin') then
      return new;
    end if;
    -- Owners may submit themselves for review or withdraw a pending request.
    if auth.uid() = new.id
       and (
         (old.verification_status = 'unverified' and new.verification_status = 'pending')
         or (old.verification_status = 'pending' and new.verification_status = 'unverified')
       ) then
      return new;
    end if;
    raise exception 'Only admins can change verification status (except submit/withdraw)';
  end if;
  return new;
end; $$;

-- =========================================================================
-- CATEGORIES (seeded)
-- =========================================================================
create table public.categories (
  slug text primary key,
  label text not null,
  sort_order int not null default 0
);
insert into public.categories (slug, label, sort_order) values
  ('destinations', 'Destinations', 1),
  ('hotels', 'Hotels & Resorts', 2),
  ('safari', 'Safari', 3),
  ('beach', 'Beach', 4),
  ('mountains', 'Mountains', 5),
  ('food', 'Food', 6),
  ('adventure', 'Adventure', 7),
  ('city', 'City', 8),
  ('culture', 'Culture', 9)
on conflict (slug) do nothing;

alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Add category column to business_details now that categories exists.
alter table public.business_details
  add column if not exists category_slug text references public.categories(slug);

-- =========================================================================
-- POSTS
-- =========================================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_type public.media_type not null,
  media_url text,
  poster_url text,
  text_background text,
  text_foreground text,
  caption text not null,
  location text,
  category_slug text references public.categories(slug),
  is_broadcast boolean not null default false,
  is_ad boolean not null default false,
  likes_count int not null default 0,
  comments_count int not null default 0,
  saves_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caption_length check (char_length(caption) between 1 and 2200)
);
create index posts_author_idx on public.posts(author_id);
create index posts_category_idx on public.posts(category_slug);
create index posts_broadcast_idx on public.posts(is_broadcast) where is_broadcast;
create index posts_created_idx on public.posts(created_at desc);

create trigger posts_touch before update on public.posts
for each row execute function public.touch_updated_at();

-- Only admins can flip is_broadcast / is_ad.
create or replace function public.guard_post_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if (new.is_broadcast or new.is_ad) and not public.has_role(auth.uid(), 'admin') then
      raise exception 'Only admins can create broadcast or ad posts';
    end if;
    return new;
  end if;
  if (new.is_broadcast is distinct from old.is_broadcast
      or new.is_ad is distinct from old.is_ad)
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can change broadcast/ad flags';
  end if;
  return new;
end; $$;

create trigger posts_guard_flags
before insert or update on public.posts
for each row execute function public.guard_post_flags();

alter table public.posts enable row level security;
create policy "posts public read" on public.posts for select using (true);
create policy "users create own posts" on public.posts for insert
  with check (auth.uid() = author_id);
create policy "authors update own posts" on public.posts for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own posts" on public.posts for delete
  using (auth.uid() = author_id);
create policy "admins manage all posts" on public.posts for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- POST LIKES
-- =========================================================================
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes(user_id);

alter table public.post_likes enable row level security;
create policy "likes public read" on public.post_likes for select using (true);
create policy "users like as themselves" on public.post_likes for insert
  with check (auth.uid() = user_id);
create policy "users unlike as themselves" on public.post_likes for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- POST COMMENTS
-- =========================================================================
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  inline_repost_post_id uuid references public.posts(id) on delete set null,
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint comment_length check (char_length(body) between 1 and 1000)
);
create index post_comments_post_idx on public.post_comments(post_id);
create index post_comments_parent_idx on public.post_comments(parent_id);

alter table public.post_comments enable row level security;
create policy "comments public read" on public.post_comments for select using (true);
create policy "users comment as themselves" on public.post_comments for insert
  with check (auth.uid() = author_id);
create policy "authors edit own comments" on public.post_comments for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own comments" on public.post_comments for delete
  using (auth.uid() = author_id);

-- =========================================================================
-- BOARDS
-- =========================================================================
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  location text,
  created_at timestamptz not null default now(),
  constraint board_name_length check (char_length(name) between 1 and 80)
);
create index boards_owner_idx on public.boards(owner_id);

alter table public.boards enable row level security;
create policy "boards public read" on public.boards for select using (true);
create policy "owner manages own boards" on public.boards for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table public.board_posts (
  board_id uuid not null references public.boards(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (board_id, post_id)
);
create index board_posts_post_idx on public.board_posts(post_id);

alter table public.board_posts enable row level security;
create policy "board_posts public read" on public.board_posts for select using (true);
create policy "owner adds to own boards" on public.board_posts for insert
  with check (exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid()));
create policy "owner removes from own boards" on public.board_posts for delete
  using (exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid()));

-- =========================================================================
-- POST COUNT TRIGGERS
-- =========================================================================
create or replace function public.bump_post_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end; $$;
create trigger post_likes_count_trg after insert or delete on public.post_likes
for each row execute function public.bump_post_likes();

create or replace function public.bump_post_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end; $$;
create trigger post_comments_count_trg after insert or delete on public.post_comments
for each row execute function public.bump_post_comments();

create or replace function public.bump_post_saves()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set saves_count = saves_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set saves_count = greatest(saves_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end; $$;
create trigger board_posts_count_trg after insert or delete on public.board_posts
for each row execute function public.bump_post_saves();

-- =========================================================================
-- CONVERSATIONS + MESSAGES
-- =========================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_inquiry boolean not null default false,
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint message_length check (char_length(body) between 1 and 2000)
);
create index messages_conv_idx on public.messages(conversation_id, created_at);

-- helper to check membership without recursion
create or replace function public.is_conversation_member(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conv and user_id = _user
  )
$$;

alter table public.conversations enable row level security;
create policy "members read conversations" on public.conversations for select
  using (public.is_conversation_member(id, auth.uid()));
create policy "auth users create conversations" on public.conversations for insert
  with check (auth.uid() is not null);
create policy "members update conversations" on public.conversations for update
  using (public.is_conversation_member(id, auth.uid()));

alter table public.conversation_participants enable row level security;
create policy "members read participants" on public.conversation_participants for select
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "users add themselves to conversations" on public.conversation_participants for insert
  with check (auth.uid() = user_id or public.is_conversation_member(conversation_id, auth.uid()));
create policy "users update own participation" on public.conversation_participants for update
  using (auth.uid() = user_id);

alter table public.messages enable row level security;
create policy "members read messages" on public.messages for select
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "members send messages" on public.messages for insert
  with check (auth.uid() = author_id and public.is_conversation_member(conversation_id, auth.uid()));

-- bump conversation last message
create or replace function public.bump_conversation_last()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = new.body, last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end; $$;
create trigger messages_bump_conv after insert on public.messages
for each row execute function public.bump_conversation_last();

-- realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type public.notification_type not null,
  post_id uuid references public.posts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "users read own notifications" on public.notifications for select
  using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own notifications" on public.notifications for delete
  using (auth.uid() = user_id);
-- Inserts are done by triggers running as security definer; no client insert policy.

alter publication supabase_realtime add table public.notifications;

-- Notification fan-out triggers
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.posts where id = new.post_id;
  if _author is not null and _author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (_author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end; $$;
create trigger notify_like_trg after insert on public.post_likes
for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare _author uuid;
begin
  select author_id into _author from public.posts where id = new.post_id;
  if _author is not null and _author <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, post_id, body)
    values (_author, new.author_id, 'comment', new.post_id, left(new.body, 140));
  end if;
  return new;
end; $$;
create trigger notify_comment_trg after insert on public.post_comments
for each row execute function public.notify_on_comment();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.followee_id, new.follower_id, 'follow');
  return new;
end; $$;
create trigger notify_follow_trg after insert on public.follows
for each row execute function public.notify_on_follow();

create or replace function public.notify_on_inquiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare _other uuid;
begin
  if new.is_inquiry then
    -- Notify other participant on first message via separate trigger
    null;
  end if;
  return new;
end; $$;

-- =========================================================================
-- ADMIN BOOTSTRAP
-- =========================================================================
-- Lets the first ever admin claim the role. After that, only existing admins
-- can grant new admin roles via the user_roles policies.
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists(select 1 from public.user_roles where role = 'admin') then
    raise exception 'An admin already exists';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
    on conflict (user_id, role) do nothing;
  return true;
end; $$;

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('posts', 'posts', true)
on conflict (id) do nothing;

-- avatars: anyone can read, users upload into their own /<uid>/ folder
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "users upload own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users update own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own avatar" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "posts public read" on storage.objects for select
  using (bucket_id = 'posts');
create policy "users upload own post media" on storage.objects for insert
  with check (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users update own post media" on storage.objects for update
  using (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own post media" on storage.objects for delete
  using (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);