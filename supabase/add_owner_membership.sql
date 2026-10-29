-- Run in the NEW zelvo-erp project's Supabase SQL Editor after creating the
-- owner account under Authentication → Users. This does not contain a password.
insert into public.business_members (org_id, user_id, role)
select o.id, u.id, 'owner'
from auth.users u
cross join public.organizations o
where lower(u.email) = lower('sandeepkum9296@gmail.com')
  and o.id = '00000000-0000-0000-0000-000000000001'::uuid
on conflict (org_id, user_id) do update set role = 'owner';
