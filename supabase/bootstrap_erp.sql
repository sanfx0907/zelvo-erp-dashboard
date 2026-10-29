-- Zelvo ERP clean-project bootstrap
-- Run only on the new zelvo-erp project. Never apply this file to the legacy project.
-- Business data is empty at bootstrap; create/invite Auth users in Supabase Dashboard,
-- then add their auth.users IDs to business_members as owner/manager/staff.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organizations(id,name)
values ('00000000-0000-0000-0000-000000000001','Zelvo Cleaning Solutions');

create table public.business_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key(org_id,user_id)
);

create or replace function public.is_business_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (
  select 1 from public.business_members m
  where m.org_id=p_org_id and m.user_id=auth.uid()
) $$;

create or replace function public.is_business_manager(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (
  select 1 from public.business_members m
  where m.org_id=p_org_id and m.user_id=auth.uid() and m.role in ('owner','manager')
) $$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check(length(trim(name))>0),
  contact_person text not null default '',
  phone text not null default '',
  area text not null default '',
  credit_limit numeric(14,2) not null default 0 check(credit_limit>=0),
  notes text not null default '',
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id)
);
create unique index customers_active_name_uq on public.customers(org_id,lower(name)) where active;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check(length(trim(name))>0),
  sku text not null check(length(trim(sku))>0),
  unit text not null default 'unit',
  price numeric(14,2) not null check(price>=0),
  unit_cost numeric(14,2) not null default 0 check(unit_cost>=0),
  stock integer not null default 0 check(stock>=0),
  low_stock_at integer not null default 0 check(low_stock_at>=0),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  unique(org_id,sku)
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  order_no text not null,
  customer_id uuid not null,
  customer_name text not null,
  payment_method text not null check(payment_method in ('cash','credit')),
  stage text not null default 'Order Received'
    check(stage in ('Order Received','Processing','Dispatched','Delivered','Cancelled')),
  payment_status text not null default 'pending'
    check(payment_status in ('pending','unpaid','paid','credited')),
  subtotal numeric(14,2) not null check(subtotal>=0),
  total numeric(14,2) not null check(total>0),
  invoice_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  dispatched_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  unique(org_id,order_no),
  foreign key(org_id,customer_id) references public.customers(org_id,id) on delete restrict
);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  unit text not null,
  quantity integer not null check(quantity>0),
  unit_price numeric(14,2) not null check(unit_price>=0),
  unit_cost numeric(14,2) not null check(unit_cost>=0),
  line_total numeric(14,2) not null check(line_total>=0),
  created_at timestamptz not null default now(),
  unique(org_id,id),
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete cascade,
  foreign key(org_id,product_id) references public.products(org_id,id) on delete restrict
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  receipt_no text not null,
  customer_id uuid not null,
  payment_date date not null,
  method text not null check(method in ('cash','upi','bank')),
  total numeric(14,2) not null check(total>0),
  reference text not null default '',
  status text not null default 'posted' check(status in ('posted','voided')),
  recorded_by uuid not null default auth.uid(),
  recorded_at timestamptz not null default now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  unique(org_id,id),
  unique(org_id,receipt_no),
  foreign key(org_id,customer_id) references public.customers(org_id,id) on delete restrict
);

create table public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  receipt_id uuid not null,
  order_id uuid not null,
  amount numeric(14,2) not null check(amount>0),
  status text not null default 'posted' check(status in ('posted','voided')),
  created_at timestamptz not null default now(),
  unique(org_id,id),
  foreign key(org_id,receipt_id) references public.receipts(org_id,id) on delete restrict,
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict
);
create unique index receipt_allocation_one_posted_per_order
  on public.receipt_allocations(order_id) where status='posted';

create table public.order_returns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  order_id uuid not null,
  customer_id uuid not null,
  credit_note_no text not null,
  return_date date not null,
  reason text not null check(length(trim(reason))>0),
  total_credit numeric(14,2) not null default 0 check(total_credit>=0),
  status text not null default 'posted' check(status in ('posted','voided')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  unique(org_id,id),
  unique(org_id,credit_note_no),
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict,
  foreign key(org_id,customer_id) references public.customers(org_id,id) on delete restrict
);

create table public.order_return_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  return_id uuid not null,
  order_item_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  quantity integer not null check(quantity>0),
  restock boolean not null default false,
  unit_price numeric(14,2) not null check(unit_price>=0),
  credit_amount numeric(14,2) not null check(credit_amount>=0),
  created_at timestamptz not null default now(),
  foreign key(org_id,return_id) references public.order_returns(org_id,id) on delete restrict,
  foreign key(org_id,order_item_id) references public.sales_order_items(org_id,id) on delete restrict,
  foreign key(org_id,product_id) references public.products(org_id,id) on delete restrict
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  product_id uuid not null,
  quantity integer not null check(quantity<>0),
  movement_type text not null check(movement_type in ('adjustment','dispatch','return','reversal')),
  movement_date date not null,
  reason text,
  order_id uuid,
  return_id uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key(org_id,product_id) references public.products(org_id,id) on delete restrict,
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict,
  foreign key(org_id,return_id) references public.order_returns(org_id,id) on delete restrict
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  title text not null check(length(trim(title))>0),
  category text not null,
  amount numeric(14,2) not null check(amount>0),
  payment_method text not null check(payment_method in ('cash','upi','bank')),
  expense_date date not null,
  status text not null default 'posted' check(status in ('posted','voided')),
  void_reason text,
  voided_by uuid,
  voided_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.business_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  title text not null check(length(trim(title))>0),
  content text not null default '',
  note_date date not null,
  is_deleted boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_at timestamptz
);

create table public.organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  business_name text not null default 'Zelvo Cleaning Solutions',
  business_address text not null default 'Deoghar, Jharkhand',
  business_phone text not null default '',
  business_email text not null default '',
  tax_id text not null default '',
  upi_id text not null default '',
  accent_color text not null default '#168bd2',
  footer_note text not null default 'Thank you for your business.',
  terms text not null default 'Please make payment by the invoice date.',
  show_logo boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.organization_settings(org_id) values('00000000-0000-0000-0000-000000000001');

create table public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index customers_org_active_idx on public.customers(org_id,active,name);
create index products_org_active_idx on public.products(org_id,active,name);
create index orders_org_date_idx on public.sales_orders(org_id,invoice_date desc,created_at desc);
create index orders_customer_status_idx on public.sales_orders(org_id,customer_id,payment_status,stage);
create index order_items_order_idx on public.sales_order_items(org_id,order_id);
create index receipts_customer_date_idx on public.receipts(org_id,customer_id,payment_date desc);
create index allocations_order_idx on public.receipt_allocations(org_id,order_id,status);
create index returns_order_date_idx on public.order_returns(org_id,order_id,return_date desc);
create index movements_product_date_idx on public.inventory_movements(org_id,product_id,movement_date desc,created_at desc);
create index expenses_org_date_idx on public.expenses(org_id,expense_date desc);
create index notes_org_date_idx on public.business_notes(org_id,note_date desc,created_at desc) where not is_deleted;
create index audit_org_time_idx on public.audit_events(org_id,occurred_at desc);

create or replace function public.log_business_event(
  p_org_id uuid,p_action text,p_entity_type text,p_entity_id uuid,
  p_reason text default null,p_before jsonb default null,p_after jsonb default null
) returns void language plpgsql security definer set search_path=public
as $$ begin
  if auth.uid() is not null and not public.is_business_member(p_org_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data,after_data)
  values(p_org_id,auth.uid(),p_action,p_entity_type,p_entity_id,nullif(trim(p_reason),''),p_before,p_after);
end $$;

create or replace function public.create_sales_order(
  p_org_id uuid,p_customer_id uuid,p_payment_method text,p_items jsonb
) returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_order uuid:=gen_random_uuid(); v_no text; v_customer public.customers%rowtype;
  v_product public.products%rowtype; v_item jsonb; v_qty integer;
  v_total numeric(14,2):=0; v_credit numeric(14,2):=0;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_payment_method not in ('cash','credit') then raise exception 'Choose cash or credit'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product'; end if;
  select * into v_customer from public.customers where id=p_customer_id and org_id=p_org_id and active for update;
  if not found then raise exception 'Customer not found or archived'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<=0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    if not found then raise exception 'Product not found or archived'; end if;
    v_total:=v_total+v_product.price*v_qty;
  end loop;
  if p_payment_method='credit' then
    select coalesce(sum(greatest(o.total-coalesce(r.total_credit,0),0)),0) into v_credit
    from public.sales_orders o
    left join lateral (select sum(x.total_credit) total_credit from public.order_returns x where x.org_id=o.org_id and x.order_id=o.id and x.status='posted') r on true
    where o.org_id=p_org_id and o.customer_id=p_customer_id and o.payment_method='credit'
      and o.payment_status='unpaid' and o.stage<>'Cancelled';
    v_credit:=v_credit+v_total;
    if v_credit>v_customer.credit_limit then raise exception 'Credit limit exceeded. Current and pending exposure would be ₹%',round(v_credit,2); end if;
  end if;
  v_no:='ZLV-'||to_char((now() at time zone 'Asia/Kolkata')::date,'YYMMDD')||'-'||upper(substr(replace(v_order::text,'-',''),1,6));
  insert into public.sales_orders(id,org_id,order_no,customer_id,customer_name,payment_method,subtotal,total,created_by)
  values(v_order,p_org_id,v_no,p_customer_id,v_customer.name,p_payment_method,v_total,v_total,auth.uid());
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    v_qty:=(v_item->>'quantity')::integer;
    insert into public.sales_order_items(org_id,order_id,product_id,product_name,sku,unit,quantity,unit_price,unit_cost,line_total)
    values(p_org_id,v_order,v_product.id,v_product.name,v_product.sku,v_product.unit,v_qty,v_product.price,v_product.unit_cost,v_product.price*v_qty);
  end loop;
  perform public.log_business_event(p_org_id,'create','sales_order',v_order,null,null,jsonb_build_object('order_no',v_no,'total',v_total));
  return v_order;
end $$;

create or replace function public.set_order_processing(p_org_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage<>'Order Received' then raise exception 'Only a new order can move to processing'; end if;
  update public.sales_orders set stage='Processing',updated_at=now() where id=p_order_id;
  perform public.log_business_event(p_org_id,'processing','sales_order',p_order_id,null,to_jsonb(v_order),jsonb_build_object('stage','Processing'));
end $$;

create or replace function public.dispatch_order(p_org_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype; v_line record; v_receipt uuid;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage<>'Processing' then raise exception 'Move the order to Processing before dispatch'; end if;
  for v_line in select * from public.sales_order_items where org_id=p_org_id and order_id=p_order_id order by product_id loop
    update public.products set stock=stock-v_line.quantity,updated_at=now()
      where id=v_line.product_id and org_id=p_org_id and active and stock>=v_line.quantity;
    if not found then raise exception 'Not enough stock for %',v_line.product_name; end if;
    insert into public.inventory_movements(org_id,product_id,quantity,movement_type,movement_date,reason,order_id)
    values(p_org_id,v_line.product_id,-v_line.quantity,'dispatch',(now() at time zone 'Asia/Kolkata')::date,'Order dispatch',p_order_id);
  end loop;
  update public.sales_orders set stage='Dispatched',dispatched_at=now(),invoice_date=(now() at time zone 'Asia/Kolkata')::date,
    payment_status=case when payment_method='cash' then 'paid' else 'unpaid' end,updated_at=now()
  where id=p_order_id;
  if v_order.payment_method='cash' then
    v_receipt:=gen_random_uuid();
    insert into public.receipts(id,org_id,receipt_no,customer_id,payment_date,method,total,reference,recorded_by)
    values(v_receipt,p_org_id,'REC-'||upper(substr(replace(v_receipt::text,'-',''),1,10)),v_order.customer_id,
      (now() at time zone 'Asia/Kolkata')::date,'cash',v_order.total,'Cash sale',auth.uid());
    insert into public.receipt_allocations(org_id,receipt_id,order_id,amount)
    values(p_org_id,v_receipt,p_order_id,v_order.total);
  end if;
  perform public.log_business_event(p_org_id,'dispatch','sales_order',p_order_id,null,to_jsonb(v_order),jsonb_build_object('stage','Dispatched'));
end $$;

create or replace function public.post_grouped_receipt(
  p_org_id uuid,p_customer_id uuid,p_order_ids uuid[],p_method text,p_payment_date date,p_reference text default ''
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_receipt uuid:=gen_random_uuid(); v_order public.sales_orders%rowtype;
  v_due numeric(14,2); v_paid numeric(14,2); v_credits numeric(14,2); v_total numeric(14,2):=0; v_count integer:=0;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_method not in ('cash','upi','bank') then raise exception 'Choose cash, UPI, or bank'; end if;
  if p_order_ids is null or cardinality(p_order_ids)=0 then raise exception 'Select at least one invoice'; end if;
  if cardinality(p_order_ids)<>(select count(distinct x) from unnest(p_order_ids) x) then raise exception 'An invoice was selected more than once'; end if;
  perform 1 from public.sales_orders where org_id=p_org_id and id=any(p_order_ids) order by id for update;
  for v_order in select * from public.sales_orders where org_id=p_org_id and id=any(p_order_ids) order by id loop
    v_count:=v_count+1;
    if v_order.customer_id<>p_customer_id then raise exception 'All selected invoices must belong to this customer'; end if;
    if v_order.stage not in ('Dispatched','Delivered') or v_order.payment_status in ('paid','credited','pending') then raise exception 'Only dispatched, unpaid invoices can be settled'; end if;
    if p_payment_date<v_order.invoice_date or p_payment_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Payment date must be between invoice date and today'; end if;
    select coalesce(sum(total_credit),0) into v_credits from public.order_returns where org_id=p_org_id and order_id=v_order.id and status='posted';
    select coalesce(sum(a.amount),0) into v_paid from public.receipt_allocations a join public.receipts r on r.id=a.receipt_id and r.org_id=a.org_id
      where a.org_id=p_org_id and a.order_id=v_order.id and a.status='posted' and r.status='posted';
    v_due:=v_order.total-v_credits-v_paid;
    if v_due<=0 then raise exception 'Invoice % has no outstanding balance',v_order.order_no; end if;
    v_total:=v_total+v_due;
  end loop;
  if v_count<>cardinality(p_order_ids) then raise exception 'An invoice was not found in this workspace'; end if;
  insert into public.receipts(id,org_id,receipt_no,customer_id,payment_date,method,total,reference,recorded_by)
  values(v_receipt,p_org_id,'REC-'||upper(substr(replace(v_receipt::text,'-',''),1,10)),p_customer_id,p_payment_date,p_method,round(v_total,2),coalesce(trim(p_reference),''),auth.uid());
  for v_order in select * from public.sales_orders where org_id=p_org_id and id=any(p_order_ids) order by id loop
    select coalesce(sum(total_credit),0) into v_credits from public.order_returns where org_id=p_org_id and order_id=v_order.id and status='posted';
    select coalesce(sum(a.amount),0) into v_paid from public.receipt_allocations a join public.receipts r on r.id=a.receipt_id and r.org_id=a.org_id
      where a.org_id=p_org_id and a.order_id=v_order.id and a.status='posted' and r.status='posted';
    v_due:=v_order.total-v_credits-v_paid;
    insert into public.receipt_allocations(org_id,receipt_id,order_id,amount)
    values(p_org_id,v_receipt,v_order.id,v_due);
    update public.sales_orders set payment_status='paid',updated_at=now() where id=v_order.id;
  end loop;
  perform public.log_business_event(p_org_id,'post','receipt',v_receipt,null,null,jsonb_build_object('total',v_total,'invoice_count',v_count));
  return v_receipt;
end $$;

create or replace function public.void_receipt(p_org_id uuid,p_receipt_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_receipt public.receipts%rowtype; v_order record; v_paid numeric(14,2); v_credit numeric(14,2); begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can void a receipt'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a reason for voiding this receipt'; end if;
  select * into v_receipt from public.receipts where id=p_receipt_id and org_id=p_org_id for update;
  if not found or v_receipt.status<>'posted' then raise exception 'Receipt not found or already voided'; end if;
  update public.receipts set status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=trim(p_reason) where id=p_receipt_id;
  update public.receipt_allocations set status='voided' where org_id=p_org_id and receipt_id=p_receipt_id and status='posted';
  for v_order in select distinct o.id,o.total from public.sales_orders o join public.receipt_allocations a on a.org_id=o.org_id and a.order_id=o.id where a.org_id=p_org_id and a.receipt_id=p_receipt_id loop
    select coalesce(sum(a.amount),0) into v_paid from public.receipt_allocations a join public.receipts r on r.id=a.receipt_id and r.org_id=a.org_id where a.org_id=p_org_id and a.order_id=v_order.id and a.status='posted' and r.status='posted';
    select coalesce(sum(total_credit),0) into v_credit from public.order_returns where org_id=p_org_id and order_id=v_order.id and status='posted';
    update public.sales_orders set payment_status=case when v_credit>=v_order.total then 'credited' when v_paid>=v_order.total-v_credit then 'paid' else 'unpaid' end,updated_at=now() where id=v_order.id;
  end loop;
  perform public.log_business_event(p_org_id,'void','receipt',p_receipt_id,trim(p_reason),to_jsonb(v_receipt),jsonb_build_object('status','voided'));
end $$;

create or replace function public.cancel_order(p_org_id uuid,p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can cancel an order'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a cancellation reason'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage not in ('Order Received','Processing') then raise exception 'Only undispatched orders can be cancelled here; use Return for a dispatched order'; end if;
  if exists(select 1 from public.receipt_allocations where org_id=p_org_id and order_id=p_order_id and status='posted') then raise exception 'Reverse the receipt before cancelling this order'; end if;
  if exists(select 1 from public.inventory_movements where org_id=p_org_id and order_id=p_order_id) then raise exception 'This order has stock history; use an audited return/correction'; end if;
  update public.sales_orders set stage='Cancelled',payment_status='credited',cancelled_at=now(),cancellation_reason=trim(p_reason),updated_at=now() where id=p_order_id;
  perform public.log_business_event(p_org_id,'cancel','sales_order',p_order_id,trim(p_reason),to_jsonb(v_order),jsonb_build_object('stage','Cancelled'));
end $$;

create or replace function public.delete_unposted_order(p_org_id uuid,p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; v_lines jsonb; begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can delete an order'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a reason for deleting this order'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.stage not in ('Order Received','Processing') or v_order.payment_status<>'pending' then raise exception 'Only unpaid, undispatched orders can be permanently deleted'; end if;
  if exists(select 1 from public.receipt_allocations where org_id=p_org_id and order_id=p_order_id) then raise exception 'This order has receipt history; cancel it instead'; end if;
  if exists(select 1 from public.inventory_movements where org_id=p_org_id and order_id=p_order_id) then raise exception 'This order has stock history; cancel it instead'; end if;
  select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) into v_lines from public.sales_order_items i where org_id=p_org_id and order_id=p_order_id;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data)
  values(p_org_id,auth.uid(),'delete','sales_order',p_order_id,trim(p_reason),jsonb_build_object('order',to_jsonb(v_order),'items',v_lines));
  delete from public.sales_order_items where org_id=p_org_id and order_id=p_order_id;
  delete from public.sales_orders where org_id=p_org_id and id=p_order_id;
end $$;

create or replace function public.post_order_return(
  p_org_id uuid,p_order_id uuid,p_return_date date,p_reason text,p_items jsonb
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype; v_return uuid:=gen_random_uuid(); v_credit_no text;
  v_item jsonb; v_line public.sales_order_items%rowtype; v_qty integer; v_already integer; v_amount numeric(14,2); v_total numeric(14,2):=0; v_restock boolean;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can post a return'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a return reason'; end if;
  if p_return_date is null or p_return_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Enter a valid return date'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Select at least one returned item'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage not in ('Dispatched','Delivered') then raise exception 'Only dispatched or delivered orders can have a return'; end if;
  v_credit_no:='CN-'||to_char(p_return_date,'YYMMDD')||'-'||upper(substr(replace(v_return::text,'-',''),1,6));
  insert into public.order_returns(id,org_id,order_id,customer_id,credit_note_no,return_date,reason,total_credit,created_by)
  values(v_return,p_org_id,p_order_id,v_order.customer_id,v_credit_no,p_return_date,trim(p_reason),0,auth.uid());
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::integer; v_restock:=coalesce((v_item->>'restock')::boolean,false);
    if v_qty<=0 then raise exception 'Returned quantity must be greater than zero'; end if;
    select * into v_line from public.sales_order_items where id=(v_item->>'order_item_id')::uuid and org_id=p_org_id and order_id=p_order_id for update;
    if not found then raise exception 'Returned item does not belong to this order'; end if;
    select coalesce(sum(ri.quantity),0) into v_already from public.order_return_items ri join public.order_returns r on r.id=ri.return_id and r.org_id=ri.org_id where ri.org_id=p_org_id and ri.order_item_id=v_line.id and r.status='posted';
    if v_already+v_qty>v_line.quantity then raise exception 'Returned quantity exceeds the quantity sold for %',v_line.product_name; end if;
    v_amount:=round(v_line.unit_price*v_qty,2); v_total:=v_total+v_amount;
    insert into public.order_return_items(org_id,return_id,order_item_id,product_id,product_name,quantity,restock,unit_price,credit_amount)
    values(p_org_id,v_return,v_line.id,v_line.product_id,v_line.product_name,v_qty,v_restock,v_line.unit_price,v_amount);
    if v_restock then
      update public.products set stock=stock+v_qty,updated_at=now() where id=v_line.product_id and org_id=p_org_id;
      insert into public.inventory_movements(org_id,product_id,quantity,movement_type,movement_date,reason,order_id,return_id)
      values(p_org_id,v_line.product_id,v_qty,'return',p_return_date,'Saleable customer return: '||trim(p_reason),p_order_id,v_return);
    end if;
  end loop;
  update public.order_returns set total_credit=round(v_total,2) where id=v_return;
  update public.sales_orders set payment_status=case
    when (select coalesce(sum(r.total_credit),0) from public.order_returns r where r.org_id=p_org_id and r.order_id=p_order_id and r.status='posted')>=total then 'credited'
    when (select coalesce(sum(a.amount),0) from public.receipt_allocations a join public.receipts r on r.id=a.receipt_id and r.org_id=a.org_id where a.org_id=p_org_id and a.order_id=p_order_id and a.status='posted' and r.status='posted')>=total-(select coalesce(sum(x.total_credit),0) from public.order_returns x where x.org_id=p_org_id and x.order_id=p_order_id and x.status='posted') then 'paid'
    else 'unpaid' end,updated_at=now() where id=p_order_id;
  perform public.log_business_event(p_org_id,'return','order_return',v_return,trim(p_reason),null,jsonb_build_object('order_id',p_order_id,'credit_note_no',v_credit_no,'total_credit',v_total));
  return v_return;
end $$;

create or replace function public.adjust_finished_stock(
  p_org_id uuid,p_product_id uuid,p_quantity integer,p_movement_date date,p_reason text default null
) returns void language plpgsql security definer set search_path=public
as $$ begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_quantity=0 or p_movement_date is null or p_movement_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Enter a non-zero quantity and a valid date'; end if;
  update public.products set stock=stock+p_quantity,updated_at=now()
    where id=p_product_id and org_id=p_org_id and active and stock+p_quantity>=0;
  if not found then raise exception 'Product missing or adjustment would make stock negative'; end if;
  insert into public.inventory_movements(org_id,product_id,quantity,movement_type,movement_date,reason)
  values(p_org_id,p_product_id,p_quantity,'adjustment',p_movement_date,nullif(trim(coalesce(p_reason,'')),''));
  perform public.log_business_event(p_org_id,'stock_adjustment','product',p_product_id,p_reason,null,jsonb_build_object('quantity_change',p_quantity,'date',p_movement_date));
end $$;

create or replace function public.remove_customer(p_org_id uuid,p_customer_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public
as $$ declare v_customer public.customers%rowtype; begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can remove a customer'; end if;
  select * into v_customer from public.customers where id=p_customer_id and org_id=p_org_id for update;
  if not found then raise exception 'Customer not found'; end if;
  if exists(select 1 from public.sales_orders where org_id=p_org_id and customer_id=p_customer_id) or exists(select 1 from public.receipts where org_id=p_org_id and customer_id=p_customer_id) then
    update public.customers set active=false,archived_at=coalesce(archived_at,now()),updated_at=now() where id=p_customer_id;
    perform public.log_business_event(p_org_id,'archive','customer',p_customer_id,p_reason,to_jsonb(v_customer),jsonb_build_object('active',false));
    return 'archived';
  end if;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data)
  values(p_org_id,auth.uid(),'delete','customer',p_customer_id,nullif(trim(p_reason),''),to_jsonb(v_customer));
  delete from public.customers where id=p_customer_id and org_id=p_org_id;
  return 'deleted';
end $$;

create or replace function public.remove_product(p_org_id uuid,p_product_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public
as $$ declare v_product public.products%rowtype; begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can remove a product'; end if;
  select * into v_product from public.products where id=p_product_id and org_id=p_org_id for update;
  if not found then raise exception 'Product not found'; end if;
  if exists(select 1 from public.sales_order_items where org_id=p_org_id and product_id=p_product_id)
    or exists(select 1 from public.inventory_movements where org_id=p_org_id and product_id=p_product_id)
    or v_product.stock<>0 then
    update public.products set active=false,archived_at=coalesce(archived_at,now()),updated_at=now() where id=p_product_id;
    perform public.log_business_event(p_org_id,'archive','product',p_product_id,p_reason,to_jsonb(v_product),jsonb_build_object('active',false));
    return 'archived';
  end if;
  insert into public.audit_events(org_id,actor_id,action,entity_type,entity_id,reason,before_data)
  values(p_org_id,auth.uid(),'delete','product',p_product_id,nullif(trim(p_reason),''),to_jsonb(v_product));
  delete from public.products where id=p_product_id and org_id=p_org_id;
  return 'deleted';
end $$;

create or replace function public.void_expense(p_org_id uuid,p_expense_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_row public.expenses%rowtype; begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can void an expense'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Enter a reason for voiding this expense'; end if;
  select * into v_row from public.expenses where id=p_expense_id and org_id=p_org_id for update;
  if not found or v_row.status<>'posted' then raise exception 'Expense not found or already voided'; end if;
  update public.expenses set status='voided',void_reason=trim(p_reason),voided_by=auth.uid(),voided_at=now() where id=p_expense_id;
  perform public.log_business_event(p_org_id,'void','expense',p_expense_id,trim(p_reason),to_jsonb(v_row),jsonb_build_object('status','voided'));
end $$;

create or replace function public.soft_delete_note(p_org_id uuid,p_note_id uuid)
returns void language plpgsql security definer set search_path=public
as $$ declare v_row public.business_notes%rowtype; begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_row from public.business_notes where id=p_note_id and org_id=p_org_id and not is_deleted for update;
  if not found then raise exception 'Note not found'; end if;
  update public.business_notes set is_deleted=true,deleted_by=auth.uid(),deleted_at=now(),updated_at=now() where id=p_note_id;
  perform public.log_business_event(p_org_id,'soft_delete','business_note',p_note_id,null,to_jsonb(v_row),jsonb_build_object('is_deleted',true));
end $$;

create or replace function public.restore_note(p_org_id uuid,p_note_id uuid)
returns void language plpgsql security definer set search_path=public
as $$ begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  update public.business_notes set is_deleted=false,deleted_by=null,deleted_at=null,updated_at=now() where id=p_note_id and org_id=p_org_id and is_deleted;
  if not found then raise exception 'Deleted note not found'; end if;
  perform public.log_business_event(p_org_id,'restore','business_note',p_note_id,null,null,jsonb_build_object('is_deleted',false));
end $$;

alter table public.organizations enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_allocations enable row level security;
alter table public.order_returns enable row level security;
alter table public.order_return_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.business_notes enable row level security;
alter table public.organization_settings enable row level security;
alter table public.audit_events enable row level security;

create policy organization_member_select on public.organizations for select to authenticated using(public.is_business_member(id));
create policy membership_self_select on public.business_members for select to authenticated using(user_id=auth.uid());
do $$ declare t text; begin
  foreach t in array array['customers','products','sales_orders','sales_order_items','receipts','receipt_allocations','order_returns','order_return_items','inventory_movements','expenses','business_notes','organization_settings','audit_events'] loop
    execute format('create policy %I on public.%I for select to authenticated using(public.is_business_member(org_id))',t||'_member_select',t);
  end loop;
end $$;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.organizations,public.business_members,public.customers,public.products,public.sales_orders,public.sales_order_items,
  public.receipts,public.receipt_allocations,public.order_returns,public.order_return_items,public.inventory_movements,
  public.expenses,public.business_notes,public.organization_settings,public.audit_events to authenticated;
grant usage,select on all sequences in schema public to authenticated;

revoke all on function public.is_business_member(uuid) from public,anon;
revoke all on function public.is_business_manager(uuid) from public,anon;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_manager(uuid) to authenticated;
revoke all on function public.log_business_event(uuid,text,text,uuid,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.create_sales_order(uuid,uuid,text,jsonb) from public,anon;
revoke all on function public.set_order_processing(uuid,uuid) from public,anon;
revoke all on function public.dispatch_order(uuid,uuid) from public,anon;
revoke all on function public.post_grouped_receipt(uuid,uuid,uuid[],text,date,text) from public,anon;
revoke all on function public.void_receipt(uuid,uuid,text) from public,anon;
revoke all on function public.cancel_order(uuid,uuid,text) from public,anon;
revoke all on function public.delete_unposted_order(uuid,uuid,text) from public,anon;
revoke all on function public.post_order_return(uuid,uuid,date,text,jsonb) from public,anon;
revoke all on function public.adjust_finished_stock(uuid,uuid,integer,date,text) from public,anon;
revoke all on function public.remove_customer(uuid,uuid,text) from public,anon;
revoke all on function public.remove_product(uuid,uuid,text) from public,anon;
revoke all on function public.void_expense(uuid,uuid,text) from public,anon;
revoke all on function public.soft_delete_note(uuid,uuid) from public,anon;
revoke all on function public.restore_note(uuid,uuid) from public,anon;
grant execute on function public.create_sales_order(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.set_order_processing(uuid,uuid) to authenticated;
grant execute on function public.dispatch_order(uuid,uuid) to authenticated;
grant execute on function public.post_grouped_receipt(uuid,uuid,uuid[],text,date,text) to authenticated;
grant execute on function public.void_receipt(uuid,uuid,text) to authenticated;
grant execute on function public.cancel_order(uuid,uuid,text) to authenticated;
grant execute on function public.delete_unposted_order(uuid,uuid,text) to authenticated;
grant execute on function public.post_order_return(uuid,uuid,date,text,jsonb) to authenticated;
grant execute on function public.adjust_finished_stock(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.remove_customer(uuid,uuid,text) to authenticated;
grant execute on function public.remove_product(uuid,uuid,text) to authenticated;
grant execute on function public.void_expense(uuid,uuid,text) to authenticated;
grant execute on function public.soft_delete_note(uuid,uuid) to authenticated;
grant execute on function public.restore_note(uuid,uuid) to authenticated;

-- Keep the API used by the web app aligned with the production schema.
-- Credit limit exposure includes accepted orders awaiting dispatch and posted unpaid invoices.
create or replace function public.create_sales_order(
  p_org_id uuid,p_customer_id uuid,p_payment_method text,p_items jsonb
) returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_order uuid:=gen_random_uuid(); v_no text; v_customer public.customers%rowtype;
  v_product public.products%rowtype; v_item jsonb; v_qty integer;
  v_total numeric(14,2):=0; v_credit numeric(14,2):=0;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_payment_method not in ('cash','credit') then raise exception 'Choose cash or credit'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product'; end if;
  select * into v_customer from public.customers where id=p_customer_id and org_id=p_org_id and active for update;
  if not found then raise exception 'Customer not found or archived'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<=0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    if not found then raise exception 'Product not found or archived'; end if;
    v_total:=v_total+v_product.price*v_qty;
  end loop;
  if p_payment_method='credit' then
    select coalesce(sum(greatest(o.total-coalesce(r.total_credit,0),0)),0) into v_credit
    from public.sales_orders o
    left join lateral (select sum(x.total_credit) total_credit from public.order_returns x where x.org_id=o.org_id and x.order_id=o.id and x.status='posted') r on true
    where o.org_id=p_org_id and o.customer_id=p_customer_id and o.payment_method='credit'
      and o.payment_status in ('pending','unpaid') and o.stage<>'Cancelled';
    v_credit:=v_credit+v_total;
    if v_credit>v_customer.credit_limit then raise exception 'Credit limit exceeded. Current and pending exposure would be ₹%',round(v_credit,2); end if;
  end if;
  v_no:='ZLV-'||to_char((now() at time zone 'Asia/Kolkata')::date,'YYMMDD')||'-'||upper(substr(replace(v_order::text,'-',''),1,6));
  insert into public.sales_orders(id,org_id,order_no,customer_id,customer_name,payment_method,subtotal,total,created_by)
  values(v_order,p_org_id,v_no,p_customer_id,v_customer.name,p_payment_method,v_total,v_total,auth.uid());
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    v_qty:=(v_item->>'quantity')::integer;
    insert into public.sales_order_items(org_id,order_id,product_id,product_name,sku,unit,quantity,unit_price,unit_cost,line_total)
    values(p_org_id,v_order,v_product.id,v_product.name,v_product.sku,v_product.unit,v_qty,v_product.price,v_product.unit_cost,v_product.price*v_qty);
  end loop;
  perform public.log_business_event(p_org_id,'create','sales_order',v_order,null,null,jsonb_build_object('order_no',v_no,'total',v_total));
  return v_order;
end $$;

create or replace function public.set_order_delivered(p_org_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.sales_orders%rowtype;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage<>'Dispatched' then raise exception 'Only a dispatched order can be marked delivered'; end if;
  update public.sales_orders set stage='Delivered',updated_at=now() where id=p_order_id;
  perform public.log_business_event(p_org_id,'delivered','sales_order',p_order_id,null,to_jsonb(v_order),jsonb_build_object('stage','Delivered'));
end $$;

revoke all on function public.set_order_delivered(uuid,uuid) from public,anon;
grant execute on function public.set_order_delivered(uuid,uuid) to authenticated;

-- Role-checked, audited writes used by the browser application.
create or replace function public.save_customer(p_org_id uuid,p_customer_id uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid:=coalesce(p_customer_id,gen_random_uuid()); v_before jsonb; v_after jsonb; v_name text; v_limit numeric;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can edit customers'; end if;
  v_name:=trim(coalesce(p_fields->>'name','')); v_limit:=coalesce(nullif(p_fields->>'credit_limit','')::numeric,0);
  if v_name='' or v_limit<0 then raise exception 'Enter a customer name and a valid non-negative credit limit'; end if;
  if p_customer_id is null then
    insert into public.customers(id,org_id,name,contact_person,phone,area,credit_limit,notes)
    values(v_id,p_org_id,v_name,coalesce(p_fields->>'contact_person',''),coalesce(p_fields->>'phone',''),coalesce(p_fields->>'area',''),v_limit,coalesce(p_fields->>'notes','')) returning to_jsonb(customers) into v_after;
  else
    select to_jsonb(c) into v_before from public.customers c where c.id=p_customer_id and c.org_id=p_org_id for update;
    if not found then raise exception 'Customer not found'; end if;
    update public.customers set name=v_name,contact_person=coalesce(p_fields->>'contact_person',''),phone=coalesce(p_fields->>'phone',''),area=coalesce(p_fields->>'area',''),credit_limit=v_limit,notes=coalesce(p_fields->>'notes',''),updated_at=now()
    where id=p_customer_id and org_id=p_org_id returning to_jsonb(customers) into v_after;
  end if;
  perform public.log_business_event(p_org_id,case when p_customer_id is null then 'create' else 'update' end,'customer',v_id,null,v_before,v_after);
  return v_id;
end $$;

create or replace function public.save_product(p_org_id uuid,p_product_id uuid,p_fields jsonb,p_stock_date date)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid:=coalesce(p_product_id,gen_random_uuid()); v_before jsonb; v_after jsonb; v_name text; v_sku text; v_stock integer:=0;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can edit products'; end if;
  v_name:=trim(coalesce(p_fields->>'name','')); v_sku:=trim(coalesce(p_fields->>'sku',''));
  if v_name='' or v_sku='' then raise exception 'Product name and SKU are required'; end if;
  if p_product_id is null then
    v_stock:=coalesce(nullif(p_fields->>'stock','')::integer,0);
    if v_stock<0 then raise exception 'Opening stock cannot be negative'; end if;
    if v_stock>0 and (p_stock_date is null or p_stock_date>(now() at time zone 'Asia/Kolkata')::date) then raise exception 'Choose a valid opening stock date'; end if;
    insert into public.products(id,org_id,name,sku,unit,price,unit_cost,stock,low_stock_at)
    values(v_id,p_org_id,v_name,v_sku,coalesce(nullif(trim(p_fields->>'unit'),''),'unit'),coalesce(nullif(p_fields->>'price','')::numeric,0),coalesce(nullif(p_fields->>'unit_cost','')::numeric,0),0,coalesce(nullif(p_fields->>'low_stock_at','')::integer,0)) returning to_jsonb(products) into v_after;
    if v_stock>0 then perform public.adjust_finished_stock(p_org_id,v_id,v_stock,p_stock_date,'Opening balance'); end if;
  else
    select to_jsonb(p) into v_before from public.products p where p.id=p_product_id and p.org_id=p_org_id for update;
    if not found then raise exception 'Product not found'; end if;
    update public.products set name=v_name,sku=v_sku,unit=coalesce(nullif(trim(p_fields->>'unit'),''),'unit'),price=coalesce(nullif(p_fields->>'price','')::numeric,0),unit_cost=coalesce(nullif(p_fields->>'unit_cost','')::numeric,0),low_stock_at=coalesce(nullif(p_fields->>'low_stock_at','')::integer,0),updated_at=now()
    where id=p_product_id and org_id=p_org_id returning to_jsonb(products) into v_after;
  end if;
  perform public.log_business_event(p_org_id,case when p_product_id is null then 'create' else 'update' end,'product',v_id,null,v_before,v_after);
  return v_id;
end $$;

create or replace function public.restore_product(p_org_id uuid,p_product_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can restore a product'; end if;
  update public.products set active=true,archived_at=null,updated_at=now() where id=p_product_id and org_id=p_org_id and active=false;
  if not found then raise exception 'Archived product not found'; end if;
  perform public.log_business_event(p_org_id,'restore','product',p_product_id,null,null,jsonb_build_object('active',true));
end $$;

create or replace function public.save_expense(p_org_id uuid,p_expense_id uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid:=coalesce(p_expense_id,gen_random_uuid()); v_before jsonb; v_after jsonb; v_amount numeric;
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can edit expenses'; end if;
  v_amount:=coalesce(nullif(p_fields->>'amount','')::numeric,0);
  if trim(coalesce(p_fields->>'title',''))='' or trim(coalesce(p_fields->>'category',''))='' or v_amount<=0 then raise exception 'Enter a description, category, and positive amount'; end if;
  if coalesce(p_fields->>'payment_method','upi') not in ('cash','upi','bank') then raise exception 'Choose cash, UPI, or bank'; end if;
  if p_expense_id is null then
    insert into public.expenses(id,org_id,title,category,amount,payment_method,expense_date)
    values(v_id,p_org_id,trim(p_fields->>'title'),trim(p_fields->>'category'),v_amount,coalesce(p_fields->>'payment_method','upi'),coalesce(nullif(p_fields->>'expense_date','')::date,(now() at time zone 'Asia/Kolkata')::date)) returning to_jsonb(expenses) into v_after;
  else
    select to_jsonb(e) into v_before from public.expenses e where e.id=p_expense_id and e.org_id=p_org_id and e.status='posted' for update;
    if not found then raise exception 'Posted expense not found'; end if;
    update public.expenses set title=trim(p_fields->>'title'),category=trim(p_fields->>'category'),amount=v_amount,payment_method=coalesce(p_fields->>'payment_method','upi'),expense_date=coalesce(nullif(p_fields->>'expense_date','')::date,(now() at time zone 'Asia/Kolkata')::date)
    where id=p_expense_id and org_id=p_org_id returning to_jsonb(expenses) into v_after;
  end if;
  perform public.log_business_event(p_org_id,case when p_expense_id is null then 'create' else 'update' end,'expense',v_id,null,v_before,v_after);
  return v_id;
end $$;

create or replace function public.save_bill_settings(p_org_id uuid,p_fields jsonb)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can change bill settings'; end if;
  insert into public.organization_settings(org_id,business_name,business_address,business_phone,business_email,tax_id,upi_id,accent_color,footer_note,terms,show_logo,updated_at)
  values(p_org_id,coalesce(p_fields->>'business_name','Zelvo Cleaning Solutions'),coalesce(p_fields->>'business_address',''),coalesce(p_fields->>'business_phone',''),coalesce(p_fields->>'business_email',''),coalesce(p_fields->>'tax_id',''),coalesce(p_fields->>'upi_id',''),coalesce(p_fields->>'accent_color','#168bd2'),coalesce(p_fields->>'footer_note',''),coalesce(p_fields->>'terms',''),coalesce((p_fields->>'show_logo')::boolean,true),now())
  on conflict(org_id) do update set business_name=excluded.business_name,business_address=excluded.business_address,business_phone=excluded.business_phone,business_email=excluded.business_email,tax_id=excluded.tax_id,upi_id=excluded.upi_id,accent_color=excluded.accent_color,footer_note=excluded.footer_note,terms=excluded.terms,show_logo=excluded.show_logo,updated_at=now();
  perform public.log_business_event(p_org_id,'update','organization_settings',p_org_id,null,null,p_fields);
end $$;

create or replace function public.save_business_note(p_org_id uuid,p_note_id uuid,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid:=coalesce(p_note_id,gen_random_uuid()); v_before jsonb; v_after jsonb;
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if trim(coalesce(p_fields->>'title',''))='' or nullif(p_fields->>'note_date','') is null then raise exception 'Add a note title and date'; end if;
  if p_note_id is null then
    insert into public.business_notes(id,org_id,title,content,note_date,created_by)
    values(v_id,p_org_id,trim(p_fields->>'title'),coalesce(p_fields->>'content',''),(p_fields->>'note_date')::date,auth.uid()) returning to_jsonb(business_notes) into v_after;
  else
    select to_jsonb(n) into v_before from public.business_notes n where n.id=p_note_id and n.org_id=p_org_id and not n.is_deleted for update;
    if not found then raise exception 'Note not found'; end if;
    update public.business_notes set title=trim(p_fields->>'title'),content=coalesce(p_fields->>'content',''),note_date=(p_fields->>'note_date')::date,updated_at=now() where id=p_note_id and org_id=p_org_id returning to_jsonb(business_notes) into v_after;
  end if;
  perform public.log_business_event(p_org_id,case when p_note_id is null then 'create' else 'update' end,'business_note',v_id,null,v_before,v_after);
  return v_id;
end $$;

revoke all on function public.save_customer(uuid,uuid,jsonb) from public,anon;
revoke all on function public.save_product(uuid,uuid,jsonb,date) from public,anon;
revoke all on function public.restore_product(uuid,uuid) from public,anon;
revoke all on function public.save_expense(uuid,uuid,jsonb) from public,anon;
revoke all on function public.save_bill_settings(uuid,jsonb) from public,anon;
revoke all on function public.save_business_note(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_customer(uuid,uuid,jsonb) to authenticated;
grant execute on function public.save_product(uuid,uuid,jsonb,date) to authenticated;
grant execute on function public.restore_product(uuid,uuid) to authenticated;
grant execute on function public.save_expense(uuid,uuid,jsonb) to authenticated;
grant execute on function public.save_bill_settings(uuid,jsonb) to authenticated;
grant execute on function public.save_business_note(uuid,uuid,jsonb) to authenticated;

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

create or replace function public.restore_customer(p_org_id uuid,p_customer_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_business_manager(p_org_id) then raise exception 'Only an owner or manager can restore a customer'; end if;
  update public.customers set active=true,archived_at=null,updated_at=now() where id=p_customer_id and org_id=p_org_id and active=false;
  if not found then raise exception 'Archived customer not found'; end if;
  perform public.log_business_event(p_org_id,'restore','customer',p_customer_id,null,null,jsonb_build_object('active',true));
end $$;
revoke all on function public.restore_customer(uuid,uuid) from public,anon;
grant execute on function public.restore_customer(uuid,uuid) to authenticated;

