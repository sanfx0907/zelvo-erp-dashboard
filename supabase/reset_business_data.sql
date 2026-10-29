-- Zelvo business data reset for the configured starter organization.
-- This removes all business records (including all customer balances and stock).
-- It preserves the schema, organization, member logins, and bill/business settings.
-- Review the target organization before running this in Supabase SQL Editor.

select id, name
from public.organizations
where id = '00000000-0000-0000-0000-000000000001';

begin;

do $$
begin
  if not exists (
    select 1 from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
      and name = 'Zelvo Cleaning Solutions'
  ) then
    raise exception 'Reset stopped: expected Zelvo Cleaning Solutions organization was not found.';
  end if;
end $$;

-- Remove dependent transaction rows first to satisfy foreign-key constraints.
delete from public.payments
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.inventory_movements
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.sales_order_items
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.sales_orders
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.expenses
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.business_notes
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.products
where org_id = '00000000-0000-0000-0000-000000000001';

delete from public.customers
where org_id = '00000000-0000-0000-0000-000000000001';

commit;

-- A successful reset returns zero for every business-data table below.
select 'customers' as table_name, count(*) as remaining_rows from public.customers where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'products', count(*) from public.products where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'sales_orders', count(*) from public.sales_orders where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'sales_order_items', count(*) from public.sales_order_items where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'payments', count(*) from public.payments where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'inventory_movements', count(*) from public.inventory_movements where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'expenses', count(*) from public.expenses where org_id = '00000000-0000-0000-0000-000000000001'
union all select 'business_notes', count(*) from public.business_notes where org_id = '00000000-0000-0000-0000-000000000001'
order by table_name;
