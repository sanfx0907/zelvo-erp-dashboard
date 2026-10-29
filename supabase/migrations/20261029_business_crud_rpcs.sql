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
