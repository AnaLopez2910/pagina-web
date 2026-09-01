begin;

grant delete on public.orders to authenticated;

create policy "owners delete orders" on public.orders for delete to authenticated using (
  exists (
    select 1
    from public.stores s
    where s.id = store_id and s.owner_id = (select auth.uid())
  )
);

commit;
