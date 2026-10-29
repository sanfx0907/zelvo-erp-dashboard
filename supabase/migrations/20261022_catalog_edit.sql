-- Allow workspace members to edit customer and finished product details.
-- Product stock remains protected and must be changed through adjust_finished_stock().
drop policy if exists customers_member_update on public.customers;
drop policy if exists products_member_update on public.products;

create policy customers_member_update
  on public.customers for update to authenticated
  using (public.is_business_member(org_id))
  with check (public.is_business_member(org_id));

create policy products_member_update
  on public.products for update to authenticated
  using (public.is_business_member(org_id))
  with check (public.is_business_member(org_id));

revoke update on public.customers, public.products from authenticated;
grant update(name, contact_person, phone, area, credit_limit, active)
  on public.customers to authenticated;
grant update(name, sku, unit, price, unit_cost, low_stock_at, active)
  on public.products to authenticated;
