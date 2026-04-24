
create or replace function public.deny_audit_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'audit_logs is immutable'; end; $$;

-- Explicit policies on rate_limits: users can read their own; nobody writes via API (server-only).
drop policy if exists "users read own rate limits" on public.rate_limits;
create policy "users read own rate limits" on public.rate_limits for select
using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));
