-- Cover common composite foreign-key lookups and enforce date-correct returns.
create index if not exists business_members_user_idx on public.business_members(user_id);
create index if not exists inventory_movements_order_fk_idx on public.inventory_movements(org_id,order_id);
create index if not exists inventory_movements_return_fk_idx on public.inventory_movements(org_id,return_id);
create index if not exists return_items_order_item_fk_idx on public.order_return_items(org_id,order_item_id);
create index if not exists return_items_product_fk_idx on public.order_return_items(org_id,product_id);
create index if not exists return_items_return_fk_idx on public.order_return_items(org_id,return_id);
create index if not exists order_returns_customer_fk_idx on public.order_returns(org_id,customer_id);
create index if not exists receipt_allocations_receipt_fk_idx on public.receipt_allocations(org_id,receipt_id);
create index if not exists sales_order_items_product_fk_idx on public.sales_order_items(org_id,product_id);

drop policy if exists membership_self_select on public.business_members;
create policy membership_self_select on public.business_members for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.validate_order_return_date()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_invoice_date date;
begin
  select invoice_date into v_invoice_date from public.sales_orders where id=new.order_id and org_id=new.org_id;
  if not found then raise exception 'Return invoice not found'; end if;
  if new.return_date<v_invoice_date then raise exception 'Return date cannot be before the invoice date'; end if;
  return new;
end $$;
revoke all on function public.validate_order_return_date() from public,anon,authenticated;
drop trigger if exists order_returns_date_guard on public.order_returns;
create trigger order_returns_date_guard before insert or update of order_id,return_date on public.order_returns
for each row execute function public.validate_order_return_date();
