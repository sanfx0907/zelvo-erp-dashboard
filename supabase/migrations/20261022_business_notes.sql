-- Shared dated notes for the Zelvo workspace.
create table if not exists public.business_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  content text not null default '',
  note_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_notes_org_date_idx
  on public.business_notes(org_id, note_date desc, created_at desc);

alter table public.business_notes enable row level security;

drop policy if exists business_notes_member_select on public.business_notes;
drop policy if exists business_notes_member_insert on public.business_notes;
drop policy if exists business_notes_member_update on public.business_notes;
drop policy if exists business_notes_member_delete on public.business_notes;

create policy business_notes_member_select
  on public.business_notes for select to authenticated
  using (public.is_business_member(org_id));
create policy business_notes_member_insert
  on public.business_notes for insert to authenticated
  with check (public.is_business_member(org_id));
create policy business_notes_member_update
  on public.business_notes for update to authenticated
  using (public.is_business_member(org_id))
  with check (public.is_business_member(org_id));
create policy business_notes_member_delete
  on public.business_notes for delete to authenticated
  using (public.is_business_member(org_id));

grant select, insert, update, delete on public.business_notes to authenticated;
