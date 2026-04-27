
-- Find or create 1-1 conversation between current user and another user.
create or replace function public.start_dm(_other uuid, _is_inquiry boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _me uuid := auth.uid();
        _conv uuid;
begin
  if _me is null then raise exception 'Not authenticated'; end if;
  if _other is null or _other = _me then raise exception 'Invalid recipient'; end if;

  -- Find an existing 1-1 conversation that has exactly these two participants.
  select c.id into _conv
  from public.conversations c
  where exists (select 1 from public.conversation_participants p
                where p.conversation_id = c.id and p.user_id = _me)
    and exists (select 1 from public.conversation_participants p
                where p.conversation_id = c.id and p.user_id = _other)
    and (select count(*) from public.conversation_participants p
         where p.conversation_id = c.id) = 2
  limit 1;

  if _conv is not null then
    if _is_inquiry then
      update public.conversations set is_inquiry = true where id = _conv;
    end if;
    return _conv;
  end if;

  insert into public.conversations (is_inquiry) values (coalesce(_is_inquiry, false))
    returning id into _conv;
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _me);
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _other);
  return _conv;
end;
$$;

-- Mark a conversation as read for the current user.
create or replace function public.mark_conversation_read(_conv uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.conversation_participants
    set last_read_at = now()
    where conversation_id = _conv and user_id = auth.uid();
end;
$$;

-- Notify other participants when a message arrives.
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _other uuid;
begin
  for _other in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.author_id
  loop
    insert into public.notifications (user_id, actor_id, type, conversation_id, body)
    values (_other, new.author_id, 'inquiry', new.conversation_id, left(new.body, 140));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message
after insert on public.messages
for each row execute function public.notify_on_message();

-- Repost notification: when a new post quotes another post, notify the original author.
create or replace function public.notify_on_repost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _author uuid;
begin
  if new.quote_post_id is null then return new; end if;
  select author_id into _author from public.posts where id = new.quote_post_id;
  if _author is not null and _author <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (_author, new.author_id, 'repost', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_repost on public.posts;
create trigger trg_notify_on_repost
after insert on public.posts
for each row execute function public.notify_on_repost();

-- Helpful indexes
create index if not exists idx_messages_conv_created
  on public.messages (conversation_id, created_at desc);
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_board_posts_board
  on public.board_posts (board_id, added_at desc);
create index if not exists idx_conv_participants_user
  on public.conversation_participants (user_id);
