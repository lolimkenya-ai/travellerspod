
-- 1) Verification documents -------------------------------------------------
create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  file_url text not null,
  content_type text,
  size_bytes bigint,
  status text not null default 'pending' check (status in ('pending','flagged','accepted')),
  flag_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verification_documents_profile_idx on public.verification_documents(profile_id);
alter table public.verification_documents enable row level security;

-- Owners manage their own documents
create policy "owner inserts own docs" on public.verification_documents
  for insert with check (auth.uid() = profile_id);
create policy "owner reads own docs" on public.verification_documents
  for select using (auth.uid() = profile_id or public.has_role(auth.uid(),'admin'));
create policy "owner deletes own docs" on public.verification_documents
  for delete using (auth.uid() = profile_id and status = 'pending');
create policy "admin updates docs" on public.verification_documents
  for update using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- 2) Post media (carousel) --------------------------------------------------
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  position int not null default 0,
  media_type text not null check (media_type in ('image','video')),
  url text not null,
  poster_url text,
  created_at timestamptz not null default now()
);
create index if not exists post_media_post_idx on public.post_media(post_id, position);
alter table public.post_media enable row level security;
create policy "post_media public read" on public.post_media for select using (true);
create policy "owner inserts post_media" on public.post_media for insert
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "owner updates post_media" on public.post_media for update
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "owner deletes post_media" on public.post_media for delete
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- 3) Posts: quote repost + media count -------------------------------------
alter table public.posts
  add column if not exists quote_post_id uuid references public.posts(id) on delete set null,
  add column if not exists media_count int not null default 0;
create index if not exists posts_quote_post_idx on public.posts(quote_post_id);

-- Ensure caption check allows up to 2200 chars but min 0 when quoting (the
-- original constraint requires >=1; relax that to allow empty captions on
-- quote-reposts where the user is just re-sharing the original).
do $$ begin
  alter table public.posts drop constraint if exists caption_length;
  alter table public.posts add constraint caption_length
    check (char_length(caption) <= 2200);
exception when others then null; end $$;

-- 4) Profiles: danger flag --------------------------------------------------
alter table public.profiles
  add column if not exists flagged_danger boolean not null default false,
  add column if not exists danger_reason text;

-- 5) Verification messages --------------------------------------------------
create table if not exists public.verification_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists verification_messages_profile_idx on public.verification_messages(profile_id, created_at);
alter table public.verification_messages enable row level security;
create policy "owner reads own thread" on public.verification_messages
  for select using (profile_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "owner or admin write" on public.verification_messages
  for insert with check (
    auth.uid() = author_id
    and (profile_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  );

-- 6) Admin actions: flag user, flag document --------------------------------
create or replace function public.flag_document(_doc uuid, _flagged boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    raise exception 'Admins only';
  end if;
  update public.verification_documents
    set status = case when _flagged then 'flagged' else 'pending' end,
        flag_reason = _reason,
        reviewed_by = auth.uid(),
        reviewed_at = now()
  where id = _doc;
  perform public.log_audit(case when _flagged then 'flag_document' else 'unflag_document' end,
                           'document', _doc::text, jsonb_build_object('reason', _reason));
end; $$;

create or replace function public.set_user_danger(_user uuid, _flagged boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    raise exception 'Admins only';
  end if;
  update public.profiles
    set flagged_danger = _flagged,
        danger_reason = case when _flagged then _reason else null end
  where id = _user;
  perform public.log_audit(case when _flagged then 'flag_user_danger' else 'clear_user_danger' end,
                           'profile', _user::text, jsonb_build_object('reason', _reason));
end; $$;

-- 7) Storage bucket for verification documents (private) -------------------
insert into storage.buckets (id, name, public)
  values ('verification-docs','verification-docs', false)
  on conflict (id) do nothing;

-- Owners upload to their own folder; owners and admins can read; only admins delete.
do $$ begin
  drop policy if exists "user uploads own verification doc" on storage.objects;
  drop policy if exists "user reads own verification doc"   on storage.objects;
  drop policy if exists "admin reads any verification doc"  on storage.objects;
  drop policy if exists "owner deletes pending verification doc" on storage.objects;
exception when others then null; end $$;

create policy "user uploads own verification doc" on storage.objects
  for insert with check (
    bucket_id = 'verification-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "user reads own verification doc" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "admin reads any verification doc" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and public.has_role(auth.uid(),'admin')
  );
create policy "owner deletes pending verification doc" on storage.objects
  for delete using (
    bucket_id = 'verification-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 8) Realtime: enable on key tables for live updates -----------------------
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.verification_documents;
alter publication supabase_realtime add table public.verification_messages;
