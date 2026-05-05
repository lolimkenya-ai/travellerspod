create table public.business_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  description text,
  category text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_resources enable row level security;

create policy "verified businesses read active resources"
on public.business_resources
for select
using (
  is_active = true
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'business'
      and p.verification_status = 'verified'
  )
);

create policy "super_admin reads all resources"
on public.business_resources
for select
using (has_role(auth.uid(), 'super_admin'::app_role));

create policy "super_admin manages resources"
on public.business_resources
for all
using (has_role(auth.uid(), 'super_admin'::app_role))
with check (has_role(auth.uid(), 'super_admin'::app_role));

create trigger business_resources_touch_updated
before update on public.business_resources
for each row execute function public.touch_updated_at();

create index idx_business_resources_active_sort on public.business_resources(is_active, sort_order);