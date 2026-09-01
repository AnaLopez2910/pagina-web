begin;

grant insert, update, delete on public.order_items to authenticated;

create policy "owners manage order items" on public.order_items for all to authenticated using (
  exists (
    select 1
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = (select auth.uid())
  )
) with check (
  exists (
    select 1
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = (select auth.uid())
  )
);

commit;
