begin;

-- How the storefront orders products, chosen from the Productos page.
alter table public.stores add column product_sort text not null default 'manual';
alter table public.stores add constraint stores_product_sort_check
  check (product_sort in ('manual', 'category', 'name', 'price', 'newest', 'promo', 'random'));
alter table public.stores add column sold_out_last boolean not null default true;

-- Saves a manual order in one call; RLS ("owners manage products") limits it to the caller's products.
create or replace function public.reorder_products(p_product_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.products as product
  set sort_order = ordered.position
  from unnest(p_product_ids) with ordinality as ordered(id, position)
  where product.id = ordered.id;
$$;

revoke all on function public.reorder_products(uuid[]) from public, anon;
grant execute on function public.reorder_products(uuid[]) to authenticated;

commit;
