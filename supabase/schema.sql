-- Zelvo single-business starter schema. Run in Supabase SQL Editor after creating
-- the project. Keep sign-ups disabled; invite users and add them to business_members.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Zelvo Cleaning Solutions')
on conflict (id) do nothing;

create table if not exists public.business_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create or replace function public.is_business_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.business_members where org_id=p_org_id and user_id=auth.uid()) $$;
revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null, contact_person text, phone text, area text,
  credit_limit numeric(12,2) not null default 0 check (credit_limit >= 0),
  active boolean not null default true, created_at timestamptz not null default now(), unique(org_id,name), unique(org_id,id)
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  name text not null, sku text not null, unit text not null default '5L can',
  price numeric(12,2) not null check (price >= 0), unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  stock integer not null default 0 check (stock >= 0), low_stock_at integer not null default 0 check (low_stock_at >= 0),
  active boolean not null default true, created_at timestamptz not null default now(), unique(org_id,sku), unique(org_id,id)
);
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  order_no text not null, customer_id uuid not null, customer_name text not null,
  payment_method text not null check (payment_method in ('cash','credit')),
  total numeric(12,2) not null check (total > 0), stage text not null default 'Order Received'
    check (stage in ('Order Received','Processing','Dispatched','Delivered')),
  payment_status text not null default 'pending' check (payment_status in ('pending','unpaid','paid')),
  invoice_date date not null default ((now() at time zone 'Asia/Kolkata')::date), dispatched_at timestamptz, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  unique(org_id,order_no), unique(org_id,id),
  foreign key(org_id,customer_id) references public.customers(org_id,id)
);
create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  order_id uuid not null, product_id uuid not null, product_name text not null,
  qty integer not null check(qty > 0), unit_price numeric(12,2) not null check(unit_price >= 0),
  unit_cost numeric(12,2) not null check(unit_cost >= 0), line_total numeric(12,2) not null check(line_total >= 0),
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict,
  foreign key(org_id,product_id) references public.products(org_id,id) on delete restrict
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, order_id uuid not null,
  amount numeric(12,2) not null check(amount > 0), method text not null check(method in ('cash','upi','bank')),
  payment_date date not null default ((now() at time zone 'Asia/Kolkata')::date), paid_at timestamptz not null default now(), recorded_by uuid not null default auth.uid(),
  unique(order_id), foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, product_id uuid not null,
  quantity integer not null check(quantity <> 0), reason text,
  movement_date date not null default ((now() at time zone 'Asia/Kolkata')::date), order_id uuid, created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  foreign key(org_id,product_id) references public.products(org_id,id) on delete restrict,
  foreign key(org_id,order_id) references public.sales_orders(org_id,id) on delete restrict
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
  title text not null, category text not null, amount numeric(12,2) not null check(amount > 0),
  payment_method text not null check(payment_method in ('cash','upi','bank')),
  expense_date date not null default current_date, created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
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
create index if not exists business_notes_org_date_idx on public.business_notes(org_id,note_date desc,created_at desc);
create index if not exists sales_orders_org_created_idx on public.sales_orders(org_id,created_at desc);
create index if not exists sales_orders_customer_idx on public.sales_orders(org_id,customer_id);
create index if not exists sales_orders_customer_invoice_date_idx on public.sales_orders(org_id,customer_id,invoice_date);
create index if not exists sales_orders_dispatched_at_idx on public.sales_orders(org_id,dispatched_at desc);
create index if not exists payments_org_payment_date_idx on public.payments(org_id,payment_date desc);
create index if not exists inventory_movements_org_created_idx on public.inventory_movements(org_id,created_at desc);
create index if not exists inventory_movements_org_date_idx on public.inventory_movements(org_id,movement_date desc);
create index if not exists expenses_org_date_idx on public.expenses(org_id,expense_date desc);

-- Do not seed example customers or opening inventory. Enter verified business data after setup.

create or replace function public.log_initial_stock()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  if new.stock>0 then
    insert into public.inventory_movements(org_id,product_id,quantity,reason,created_by)
    values(new.org_id,new.id,new.stock,'Opening balance',auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists products_opening_stock_movement on public.products;
create trigger products_opening_stock_movement after insert on public.products
for each row execute function public.log_initial_stock();
insert into public.inventory_movements(org_id,product_id,quantity,reason)
select p.org_id,p.id,p.stock,'Opening balance' from public.products p
where p.stock>0 and not exists(select 1 from public.inventory_movements m where m.product_id=p.id);
revoke all on function public.log_initial_stock() from public;

alter table public.business_members enable row level security;
alter table public.organizations enable row level security;
do $$ declare t text; begin
  foreach t in array array['customers','products','sales_orders','sales_order_items','payments','inventory_movements','expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(org_id))', t||'_member_select', t);
  end loop;
end $$;
create policy organization_member_select on public.organizations for select to authenticated using (public.is_business_member(id));
create policy membership_self_select on public.business_members for select to authenticated using (user_id=auth.uid());
alter table public.organization_settings enable row level security;
create policy organization_settings_member_select on public.organization_settings for select to authenticated using (public.is_business_member(org_id));
create policy organization_settings_member_insert on public.organization_settings for insert to authenticated with check (public.is_business_member(org_id));
create policy organization_settings_member_update on public.organization_settings for update to authenticated using (public.is_business_member(org_id)) with check (public.is_business_member(org_id));
alter table public.business_notes enable row level security;
create policy business_notes_member_select on public.business_notes for select to authenticated using (public.is_business_member(org_id));
create policy business_notes_member_insert on public.business_notes for insert to authenticated with check (public.is_business_member(org_id));
create policy business_notes_member_update on public.business_notes for update to authenticated using (public.is_business_member(org_id)) with check (public.is_business_member(org_id));
create policy business_notes_member_delete on public.business_notes for delete to authenticated using (public.is_business_member(org_id));
create policy customers_member_insert on public.customers for insert to authenticated with check(public.is_business_member(org_id));
create policy products_member_insert on public.products for insert to authenticated with check(public.is_business_member(org_id));
create policy customers_member_update on public.customers for update to authenticated using(public.is_business_member(org_id)) with check(public.is_business_member(org_id));
create policy products_member_update on public.products for update to authenticated using(public.is_business_member(org_id)) with check(public.is_business_member(org_id));
create policy expenses_member_insert on public.expenses for insert to authenticated with check(public.is_business_member(org_id));
-- Posted order changes go through the validated RPC functions below.

create or replace function public.create_sales_order(p_org_id uuid, p_customer_id uuid, p_payment_method text, p_items jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_order uuid:=gen_random_uuid(); v_no text; v_customer public.customers%rowtype; v_total numeric(12,2):=0; v_item jsonb; v_product public.products%rowtype; v_qty integer; v_due numeric(12,2);
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_payment_method not in ('cash','credit') then raise exception 'Choose full payment or credit'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product'; end if;
  -- Serialize credit-limit checks for this customer so simultaneous devices cannot overbook credit.
  select * into v_customer from public.customers where id=p_customer_id and org_id=p_org_id and active for update;
  if not found then raise exception 'Customer not found'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'qty')::integer;
    if v_qty<=0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    if not found then raise exception 'Product not found'; end if;
    v_total:=v_total+v_product.price*v_qty;
  end loop;
  if p_payment_method='credit' then
    select coalesce(sum(total),0) into v_due from public.sales_orders where org_id=p_org_id and customer_id=p_customer_id and stage<>'Order Received' and payment_status='unpaid';
    v_due:=v_due+coalesce((select sum(total) from public.sales_orders where org_id=p_org_id and customer_id=p_customer_id and stage='Order Received' and payment_method='credit'),0)+v_total;
    if v_due>v_customer.credit_limit then raise exception 'This order exceeds the customer credit limit. Outstanding plus this order: ₹%',round(v_due,2); end if;
  end if;
  v_no:='ZLV-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(v_order::text,'-',''),1,6));
  insert into public.sales_orders(id,org_id,order_no,customer_id,customer_name,payment_method,total,created_by)
  values(v_order,p_org_id,v_no,p_customer_id,v_customer.name,p_payment_method,v_total,auth.uid());
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id;
    v_qty:=(v_item->>'qty')::integer;
    insert into public.sales_order_items(org_id,order_id,product_id,product_name,qty,unit_price,unit_cost,line_total)
    values(p_org_id,v_order,v_product.id,v_product.name,v_qty,v_product.price,v_product.unit_cost,v_product.price*v_qty);
  end loop;
  return v_order;
end $$;

create or replace function public.dispatch_sales_order(p_org_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; v_line record; begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.stage<>'Order Received' then raise exception 'Only new orders can be dispatched'; end if;
  for v_line in select * from public.sales_order_items where order_id=p_order_id and org_id=p_org_id loop
    update public.products set stock=stock-v_line.qty where id=v_line.product_id and org_id=p_org_id and stock>=v_line.qty;
    if not found then raise exception 'Not enough stock for %',v_line.product_name; end if;
    insert into public.inventory_movements(org_id,product_id,quantity,reason,order_id) values(p_org_id,v_line.product_id,-v_line.qty,'Sale dispatch',p_order_id);
  end loop;
  update public.sales_orders set stage='Dispatched',invoice_date=(now() at time zone 'Asia/Kolkata')::date,dispatched_at=now(),payment_status=case when payment_method='cash' then 'paid' else 'unpaid' end where id=p_order_id;
  if v_order.payment_method='cash' then insert into public.payments(org_id,order_id,amount,method) values(p_org_id,p_order_id,v_order.total,'cash'); end if;
end $$;

create or replace function public.collect_invoice_full(p_org_id uuid,p_order_id uuid,p_method text default 'cash',p_payment_date date default ((now() at time zone 'Asia/Kolkata')::date))
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage='Order Received' then raise exception 'Dispatch this order before collecting payment'; end if;
  if v_order.payment_status='paid' then raise exception 'This invoice is already paid'; end if;
  if p_method not in ('cash','upi','bank') then raise exception 'Invalid payment method'; end if;
  if p_payment_date is null or p_payment_date<v_order.invoice_date or p_payment_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Payment date must be between the invoice date and today'; end if;
  insert into public.payments(org_id,order_id,amount,method,payment_date) values(p_org_id,p_order_id,v_order.total,p_method,p_payment_date);
  update public.sales_orders set payment_status='paid' where id=p_order_id;
end $$;

create or replace function public.adjust_finished_stock(p_org_id uuid,p_product_id uuid,p_quantity integer,p_movement_date date,p_reason text default null)
returns void language plpgsql security definer set search_path=public
as $$ begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_quantity=0 or p_movement_date is null or p_movement_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Enter a non-zero quantity and a valid date'; end if;
  update public.products set stock=stock+p_quantity where id=p_product_id and org_id=p_org_id and stock+p_quantity>=0;
  if not found then raise exception 'Product missing or adjustment would make stock negative'; end if;
  insert into public.inventory_movements(org_id,product_id,quantity,reason,movement_date) values(p_org_id,p_product_id,p_quantity,nullif(trim(coalesce(p_reason,'')),''),p_movement_date);
end $$;

create or replace function public.update_order_stage(p_org_id uuid,p_order_id uuid,p_stage text)
returns void language plpgsql security definer set search_path=public
as $$ declare v_order public.sales_orders%rowtype; begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_stage not in ('Processing','Delivered') then raise exception 'Invalid status'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and org_id=p_org_id for update;
  if not found or v_order.stage='Order Received' then raise exception 'Dispatch the order first'; end if;
  update public.sales_orders set stage=p_stage where id=p_order_id;
end $$;

revoke all on function public.create_sales_order(uuid,uuid,text,jsonb) from public;
revoke all on function public.dispatch_sales_order(uuid,uuid) from public;
revoke all on function public.collect_invoice_full(uuid,uuid,text,date) from public;
revoke all on function public.adjust_finished_stock(uuid,uuid,integer,date,text) from public;
revoke all on function public.update_order_stage(uuid,uuid,text) from public;
grant execute on function public.create_sales_order(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.dispatch_sales_order(uuid,uuid) to authenticated;
grant execute on function public.collect_invoice_full(uuid,uuid,text,date) to authenticated;
grant execute on function public.adjust_finished_stock(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.update_order_stage(uuid,uuid,text) to authenticated;
grant select,insert on public.customers,public.products,public.expenses to authenticated;
grant update(name,contact_person,phone,area,credit_limit,active) on public.customers to authenticated;
grant update(name,sku,unit,price,unit_cost,low_stock_at,active) on public.products to authenticated;
grant select on public.sales_orders,public.sales_order_items,public.payments,public.inventory_movements to authenticated;
grant select,insert,update on public.organization_settings to authenticated;
grant select,insert,update,delete on public.business_notes to authenticated;

insert into public.organization_settings(org_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict(org_id) do nothing;

-- After the first user signs in, add them as workspace owner. Replace USER_UUID
-- with auth.users.id from Supabase Authentication > Users:
-- insert into public.business_members(org_id,user_id,role)
-- values ('00000000-0000-0000-0000-000000000001','USER_UUID','owner');
