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
