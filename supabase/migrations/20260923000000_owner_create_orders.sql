begin;

grant insert on public.orders to authenticated;

create policy "owners create orders" on public.orders for insert to authenticated with check (
  exists (
    select 1
    from public.stores s
    where s.id = store_id and s.owner_id = (select auth.uid())
  )
);

commit;
