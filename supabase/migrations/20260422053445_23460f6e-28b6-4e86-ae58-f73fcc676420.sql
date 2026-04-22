create or replace function public.prevent_self_follow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.follower_id = new.followee_id then
    raise exception 'You cannot follow yourself';
  end if;
  return new;
end; $$;
