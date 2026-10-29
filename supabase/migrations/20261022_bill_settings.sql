-- Run this migration in the Supabase SQL Editor if Zelvo's original schema.sql
-- was already installed before the Bill Generator was added.
create table if not exists public.organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  business_name text not null default 'Zelvo Cleaning Solutions',
  business_address text not null default 'Deoghar, Jharkhand',
  business_phone text not null default '', business_email text not null default '',
  tax_id text not null default '', upi_id text not null default '',
  accent_color text not null default '#168bd2', footer_note text not null default 'Thank you for your business.',
  terms text not null default '', show_logo boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.organization_settings enable row level security;
drop policy if exists organization_settings_member_select on public.organization_settings;
drop policy if exists organization_settings_member_insert on public.organization_settings;
drop policy if exists organization_settings_member_update on public.organization_settings;
create policy organization_settings_member_select on public.organization_settings for select to authenticated using (public.is_business_member(org_id));
create policy organization_settings_member_insert on public.organization_settings for insert to authenticated with check (public.is_business_member(org_id));
create policy organization_settings_member_update on public.organization_settings for update to authenticated using (public.is_business_member(org_id)) with check (public.is_business_member(org_id));
grant select,insert,update on public.organization_settings to authenticated;
insert into public.organization_settings(org_id) values ('00000000-0000-0000-0000-000000000001') on conflict(org_id) do nothing;
