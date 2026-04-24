
do $$ begin
  if not exists (select 1 from pg_enum where enumlabel = 'super_admin' and enumtypid = 'public.app_role'::regtype) then
    alter type public.app_role add value 'super_admin';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_enum where enumlabel = 'moderator' and enumtypid = 'public.app_role'::regtype) then
    alter type public.app_role add value 'moderator';
  end if;
end $$;
