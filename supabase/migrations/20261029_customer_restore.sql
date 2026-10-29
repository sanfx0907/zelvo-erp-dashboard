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
