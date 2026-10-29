-- Add business transaction dates for ledger entries and make stock notes optional.
alter table public.sales_orders add column if not exists dispatched_at timestamptz;
update public.sales_orders set dispatched_at=created_at where stage<>'Order Received' and dispatched_at is null;
alter table public.sales_orders add column if not exists invoice_date date;
update public.sales_orders set invoice_date=coalesce((dispatched_at at time zone 'Asia/Kolkata')::date,(created_at at time zone 'Asia/Kolkata')::date) where invoice_date is null;
alter table public.sales_orders alter column invoice_date set default ((now() at time zone 'Asia/Kolkata')::date);
alter table public.sales_orders alter column invoice_date set not null;

alter table public.payments add column if not exists payment_date date;
update public.payments set payment_date=(paid_at at time zone 'Asia/Kolkata')::date where payment_date is null;
alter table public.payments alter column payment_date set default ((now() at time zone 'Asia/Kolkata')::date);
alter table public.payments alter column payment_date set not null;

alter table public.inventory_movements add column if not exists movement_date date;
update public.inventory_movements set movement_date=(created_at at time zone 'Asia/Kolkata')::date where movement_date is null;
alter table public.inventory_movements alter column movement_date set default ((now() at time zone 'Asia/Kolkata')::date);
alter table public.inventory_movements alter column movement_date set not null;
alter table public.inventory_movements alter column reason drop not null;
create index if not exists sales_orders_customer_invoice_date_idx on public.sales_orders(org_id,customer_id,invoice_date);
create index if not exists sales_orders_dispatched_at_idx on public.sales_orders(org_id,dispatched_at desc);
create index if not exists payments_org_payment_date_idx on public.payments(org_id,payment_date desc);
create index if not exists inventory_movements_org_date_idx on public.inventory_movements(org_id,movement_date desc);

create or replace function public.dispatch_sales_order(p_org_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype; v_line record;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.stage<>'Order Received' then raise exception 'Only new orders can be dispatched'; end if;
  for v_line in select * from public.sales_order_items where order_id=p_order_id and org_id=p_org_id loop
    update public.products set stock=stock-v_line.qty where id=v_line.product_id and org_id=p_org_id and stock>=v_line.qty;
    if not found then raise exception 'Not enough stock for %',v_line.product_name; end if;
    insert into public.inventory_movements(org_id,product_id,quantity,reason,order_id)
    values(p_org_id,v_line.product_id,-v_line.qty,'Sale dispatch',p_order_id);
  end loop;
  update public.sales_orders
  set stage='Dispatched',invoice_date=(now() at time zone 'Asia/Kolkata')::date,dispatched_at=now(),
      payment_status=case when payment_method='cash' then 'paid' else 'unpaid' end
  where id=p_order_id;
  if v_order.payment_method='cash' then
    insert into public.payments(org_id,order_id,amount,method)
    values(p_org_id,p_order_id,v_order.total,'cash');
  end if;
end $$;

drop function if exists public.collect_invoice_full(uuid,uuid,text);
drop function if exists public.collect_invoice_full(uuid,uuid,text,date);
create function public.collect_invoice_full(
  p_org_id uuid,
  p_order_id uuid,
  p_method text default 'cash',
  p_payment_date date default ((now() at time zone 'Asia/Kolkata')::date)
)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage='Order Received' then raise exception 'Dispatch this order before collecting payment'; end if;
  if v_order.payment_status='paid' then raise exception 'This invoice is already paid'; end if;
  if p_method not in ('cash','upi','bank') then raise exception 'Invalid payment method'; end if;
  if p_payment_date is null or p_payment_date<v_order.invoice_date or p_payment_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Payment date must be between the invoice date and today'; end if;
  insert into public.payments(org_id,order_id,amount,method,payment_date)
  values(p_org_id,p_order_id,v_order.total,p_method,p_payment_date);
  update public.sales_orders set payment_status='paid' where id=p_order_id;
end $$;

drop function if exists public.adjust_finished_stock(uuid,uuid,integer,text);
drop function if exists public.adjust_finished_stock(uuid,uuid,integer,date,text);
create function public.adjust_finished_stock(
  p_org_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_movement_date date,
  p_reason text default null
)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_quantity=0 or p_movement_date is null or p_movement_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Enter a non-zero quantity and a valid date'; end if;
  update public.products set stock=stock+p_quantity where id=p_product_id and org_id=p_org_id and stock+p_quantity>=0;
  if not found then raise exception 'Product missing or adjustment would make stock negative'; end if;
  insert into public.inventory_movements(org_id,product_id,quantity,reason,movement_date)
  values(p_org_id,p_product_id,p_quantity,nullif(trim(coalesce(p_reason,'')),''),p_movement_date);
end $$;

revoke all on function public.collect_invoice_full(uuid,uuid,text,date) from public;
grant execute on function public.collect_invoice_full(uuid,uuid,text,date) to authenticated;
revoke all on function public.adjust_finished_stock(uuid,uuid,integer,date,text) from public;
grant execute on function public.adjust_finished_stock(uuid,uuid,integer,date,text) to authenticated;
