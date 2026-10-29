-- Apply to an existing database to serialize credit-limit checks across devices.
create or replace function public.create_sales_order(p_org_id uuid, p_customer_id uuid, p_payment_method text, p_items jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  v_order uuid:=gen_random_uuid();
  v_no text;
  v_customer public.customers%rowtype;
  v_total numeric(12,2):=0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_due numeric(12,2);
begin
  if not public.is_business_member(p_org_id) then raise exception 'Not authorized for this workspace'; end if;
  if p_payment_method not in ('cash','credit') then raise exception 'Choose full payment or credit'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one product'; end if;

  -- The row lock makes simultaneous credit checks for the same customer run in sequence.
  select * into v_customer
  from public.customers
  where id=p_customer_id and org_id=p_org_id and active
  for update;
  if not found then raise exception 'Customer not found'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'qty')::integer;
    if v_qty<=0 then raise exception 'Quantity must be greater than zero'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and org_id=p_org_id and active;
    if not found then raise exception 'Product not found'; end if;
    v_total:=v_total+v_product.price*v_qty;
  end loop;

  if p_payment_method='credit' then
    select coalesce(sum(total),0) into v_due
    from public.sales_orders
    where org_id=p_org_id and customer_id=p_customer_id and stage<>'Order Received' and payment_status='unpaid';
    v_due:=v_due+coalesce((select sum(total) from public.sales_orders where org_id=p_org_id and customer_id=p_customer_id and stage='Order Received' and payment_method='credit'),0)+v_total;
    if v_due>v_customer.credit_limit then
      raise exception 'This order exceeds the customer credit limit. Outstanding plus this order: ₹%',round(v_due,2);
    end if;
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
end
$$;

revoke all on function public.create_sales_order(uuid,uuid,text,jsonb) from public;
grant execute on function public.create_sales_order(uuid,uuid,text,jsonb) to authenticated;
