-- Allow audited removal of cancelled, never-posted orders and expense entries.
-- Financially posted invoices remain returnable, not physically deletable.

create or replace function public.delete_unposted_order(p_org_id uuid,p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype; v_lines jsonb;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can delete an order'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a reason for deleting this order'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.stage not in ('Order Received','Processing','Cancelled') then raise exception 'Only undispatched, never-invoiced orders can be permanently deleted'; end if;
  if v_order.stage<>'Cancelled' and v_order.payment_status<>'pending' then raise exception 'Only unpaid, undispatched orders can be permanently deleted'; end if;
  if exists(select 1 from public.receipt_allocations where org_id=p_org_id and order_id=p_order_id) then raise exception 'This order has receipt history; keep its audit trail'; end if;
  if exists(select 1 from public.inventory_movements where org_id=p_org_id and order_id=p_order_id) then raise exception 'This order has stock history; use an audited return/correction'; end if;
  select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_lines from public.sales_order_items i where org_id=p_org_id and order_id=p_order_id;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data)
  values(p_org_id,auth.uid(),'delete','sales_order',p_order_id,trim(p_reason),jsonb_build_object('order',to_jsonb(v_order),'items',v_lines));
  delete from public.sales_order_items where org_id=p_org_id and order_id=p_order_id;
  delete from public.sales_orders where org_id=p_org_id and id=p_order_id;
end $$;

create or replace function public.delete_expense(p_org_id uuid,p_expense_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_expense public.expenses%rowtype;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can delete an expense'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a reason for deleting this expense'; end if;
  select * into v_expense from public.expenses where org_id=p_org_id and id=p_expense_id for update;
  if not found then raise exception 'Expense not found'; end if;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data)
  values(p_org_id,auth.uid(),'delete','expense',p_expense_id,trim(p_reason),to_jsonb(v_expense));
  delete from public.expenses where org_id=p_org_id and id=p_expense_id;
end $$;

revoke all on function public.delete_expense(uuid,uuid,text) from public,anon;
grant execute on function public.delete_expense(uuid,uuid,text) to authenticated;
