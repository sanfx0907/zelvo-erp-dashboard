-- A reset may only follow the exact audit-history snapshot included in the backup.
-- Locking writes for the export gives the downloaded JSON a consistent database view.

create or replace function public.export_business_data(p_org_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_backup jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members m
    where m.org_id=p_org_id and m.user_id=auth.uid() and m.role in ('owner','manager')
  ) then raise exception 'Only a workspace owner or manager can export the backup'; end if;

  lock table public.customers,public.products,public.sales_orders,public.sales_order_items,
    public.receipts,public.receipt_allocations,public.order_returns,public.order_return_items,
    public.inventory_movements,public.expenses,public.business_notes,public.audit_events
    in share mode;

  select jsonb_build_object(
    'format','zelvo-workspace-backup-v2','generated_at',clock_timestamp(),
    'organization',(select to_jsonb(o) from public.organizations o where o.id=p_org_id),
    'settings',(select to_jsonb(s) from public.organization_settings s where s.org_id=p_org_id),
    'customers',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.customers x where x.org_id=p_org_id),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.products x where x.org_id=p_org_id),'[]'::jsonb),
    'sales_orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.sales_orders x where x.org_id=p_org_id),'[]'::jsonb),
    'sales_order_items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.sales_order_items x where x.org_id=p_org_id),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.recorded_at,x.id) from public.receipts x where x.org_id=p_org_id),'[]'::jsonb),
    'receipt_allocations',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.receipt_allocations x where x.org_id=p_org_id),'[]'::jsonb),
    'order_returns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.order_returns x where x.org_id=p_org_id),'[]'::jsonb),
    'order_return_items',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.order_return_items x where x.org_id=p_org_id),'[]'::jsonb),
    'inventory_movements',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.inventory_movements x where x.org_id=p_org_id),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.expenses x where x.org_id=p_org_id),'[]'::jsonb),
    'business_notes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.business_notes x where x.org_id=p_org_id),'[]'::jsonb),
    'audit_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at,x.id) from public.audit_events x where x.org_id=p_org_id),'[]'::jsonb)
  ) into v_backup;
  return v_backup;
end;
$$;

drop function if exists public.reset_business_data(uuid,text);
create function public.reset_business_data(p_org_id uuid,p_confirmation text,p_backup_audit_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_counts jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_members m
    where m.org_id=p_org_id and m.user_id=auth.uid() and m.role='owner'
  ) then raise exception 'Only the workspace owner can reset business data'; end if;
  if p_confirmation is distinct from 'RESET ZELVO DATA' then raise exception 'Reset confirmation did not match'; end if;
  if p_backup_audit_id is null then raise exception 'Download a fresh backup before resetting data'; end if;
  perform 1 from public.organizations o where o.id=p_org_id for update;
  if not found then raise exception 'Workspace not found'; end if;

  lock table public.customers,public.products,public.sales_orders,public.sales_order_items,
    public.receipts,public.receipt_allocations,public.order_returns,public.order_return_items,
    public.inventory_movements,public.expenses,public.business_notes,public.audit_events
    in access exclusive mode;

  if exists(select 1 from public.audit_events a where a.org_id=p_org_id and a.id>p_backup_audit_id) then
    raise exception 'Business records changed after that backup. Download a fresh backup and try again.';
  end if;

  select jsonb_build_object(
    'customers',(select count(*) from public.customers where org_id=p_org_id),
    'products',(select count(*) from public.products where org_id=p_org_id),
    'sales_orders',(select count(*) from public.sales_orders where org_id=p_org_id),
    'sales_order_items',(select count(*) from public.sales_order_items where org_id=p_org_id),
    'receipts',(select count(*) from public.receipts where org_id=p_org_id),
    'receipt_allocations',(select count(*) from public.receipt_allocations where org_id=p_org_id),
    'order_returns',(select count(*) from public.order_returns where org_id=p_org_id),
    'order_return_items',(select count(*) from public.order_return_items where org_id=p_org_id),
    'inventory_movements',(select count(*) from public.inventory_movements where org_id=p_org_id),
    'expenses',(select count(*) from public.expenses where org_id=p_org_id),
    'business_notes',(select count(*) from public.business_notes where org_id=p_org_id),
    'audit_events',(select count(*) from public.audit_events where org_id=p_org_id)
  ) into v_counts;

  delete from public.inventory_movements where org_id=p_org_id;
  delete from public.order_return_items where org_id=p_org_id;
  delete from public.order_returns where org_id=p_org_id;
  delete from public.receipt_allocations where org_id=p_org_id;
  delete from public.receipts where org_id=p_org_id;
  delete from public.sales_order_items where org_id=p_org_id;
  delete from public.sales_orders where org_id=p_org_id;
  delete from public.expenses where org_id=p_org_id;
  delete from public.business_notes where org_id=p_org_id;
  delete from public.products where org_id=p_org_id;
  delete from public.customers where org_id=p_org_id;
  delete from public.audit_events where org_id=p_org_id;

  insert into public.audit_events(org_id,actor_id,action,entity_type,reason,before_data,after_data)
  values(p_org_id,auth.uid(),'reset','workspace','Owner confirmed complete business-data reset',v_counts,
    jsonb_build_object('preserved',jsonb_build_array('organization','organization_settings','business_members','reset_audit_event')));
  return v_counts;
end;
$$;

revoke all on function public.reset_business_data(uuid,text,bigint) from public,anon;
grant execute on function public.reset_business_data(uuid,text,bigint) to authenticated;
