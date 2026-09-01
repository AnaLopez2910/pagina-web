create extension if not exists pgcrypto;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 90),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  whatsapp_phone text not null,
  logo_path text,
  hero_title text,
  hero_subtitle text,
  address text,
  theme jsonb not null default '{"primary":"#c45782","accent":"#e7b6ca","font":"Inter"}'::jsonb,
  business_hours jsonb not null default '{"timezone":"America/Argentina/Buenos_Aires","days":{"monday":[],"tuesday":[],"wednesday":[],"thursday":[],"friday":[],"saturday":[],"sunday":[]}}'::jsonb,
  restrict_by_schedule boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null,
  description text,
  base_price integer not null check (base_price >= 0),
  promo_price integer check (promo_price is null or (promo_price > 0 and promo_price < base_price)),
  image_paths text[] not null default '{}',
  is_visible boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  selection_type text not null check (selection_type in ('SINGLE', 'MULTIPLE')),
  is_required boolean not null default false,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer check (max_selections is null or max_selections > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  price_delta integer not null default 0,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  status text not null default 'PENDING_WHATSAPP' check (status in ('PENDING_WHATSAPP', 'PAID', 'DELIVERED', 'CANCELLED')),
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 100),
  customer_phone text not null check (char_length(btrim(customer_phone)) between 6 and 40),
  fulfillment text not null check (char_length(btrim(fulfillment)) between 2 and 80),
  notes text check (notes is null or char_length(notes) <= 500),
  total integer not null check (total >= 0),
  checkout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  unit_price integer not null check (unit_price >= 0),
  options jsonb not null default '[]'::jsonb,
  subtotal integer not null check (subtotal >= 0)
);

create index products_store_visible_idx on public.products(store_id, is_visible, sort_order);
create index categories_store_sort_idx on public.categories(store_id, sort_order);
create index option_groups_product_sort_idx on public.option_groups(product_id, sort_order);
create index product_options_group_sort_idx on public.product_options(option_group_id, sort_order);
create index orders_store_created_idx on public.orders(store_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_updated_at before update on public.stores for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger option_groups_updated_at before update on public.option_groups for each row execute function public.set_updated_at();
create trigger product_options_updated_at before update on public.product_options for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
revoke execute on function public.set_updated_at() from public, anon, authenticated;

alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.stores, public.categories, public.products, public.option_groups, public.product_options, public.orders, public.order_items from anon, authenticated;
grant select on public.stores, public.categories, public.products, public.option_groups, public.product_options to anon;
grant select, update on public.stores to authenticated;
grant select, insert, update, delete on public.categories, public.products, public.option_groups, public.product_options to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "published stores are public" on public.stores for select to anon using (is_published);
create policy "owners can read their store" on public.stores for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners can update their store" on public.stores for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "published categories are public" on public.categories for select to anon using (
  exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
create policy "owners manage categories" on public.categories for all to authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

create policy "visible products are public" on public.products for select to anon using (
  is_visible and exists (select 1 from public.stores s where s.id = store_id and s.is_published)
);
create policy "owners manage products" on public.products for all to authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

create policy "visible option groups are public" on public.option_groups for select to anon using (
  exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and p.is_visible and s.is_published)
);
create policy "owners manage option groups" on public.option_groups for all to authenticated using (
  exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid()))
);

create policy "available product options are public" on public.product_options for select to anon using (
  exists (
    select 1 from public.option_groups g join public.products p on p.id = g.product_id join public.stores s on s.id = p.store_id
    where g.id = option_group_id and is_available and p.is_visible and s.is_published
  )
);
create policy "owners manage product options" on public.product_options for all to authenticated using (
  exists (
    select 1 from public.option_groups g join public.products p on p.id = g.product_id join public.stores s on s.id = p.store_id
    where g.id = option_group_id and s.owner_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.option_groups g join public.products p on p.id = g.product_id join public.stores s on s.id = p.store_id
    where g.id = option_group_id and s.owner_id = (select auth.uid())
  )
);

create policy "owners read orders" on public.orders for select to authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);
create policy "owners update orders" on public.orders for update to authenticated using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);
create policy "owners read order items" on public.order_items for select to authenticated using (
  exists (
    select 1 from public.orders o join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = (select auth.uid())
  )
);

create or replace function public.create_public_order(
  p_store_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment text,
  p_notes text,
  p_items jsonb
)
returns table(order_id uuid, code text, total integer, store_name text, whatsapp_phone text, items jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_row public.stores%rowtype;
  product_row public.products%rowtype;
  group_row public.option_groups%rowtype;
  option_row public.product_options%rowtype;
  item jsonb;
  selected_id text;
  selected_ids jsonb;
  selected_count integer;
  valid_selected_count integer;
  unit_price integer;
  item_quantity integer;
  item_subtotal integer;
  order_total integer;
  order_code text;
  created_order_id uuid;
  item_options jsonb;
begin
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
  if char_length(btrim(coalesce(p_customer_phone, ''))) not between 6 and 40 then raise exception 'Teléfono inválido'; end if;
  if char_length(btrim(coalesce(p_fulfillment, ''))) not between 2 and 80 then raise exception 'Modalidad inválida'; end if;
  if p_notes is not null and char_length(p_notes) > 500 then raise exception 'Notas demasiado largas'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 80 then raise exception 'El pedido no tiene productos válidos'; end if;

  select * into store_row from public.stores where slug = btrim(p_store_slug) and is_published for update;
  if not found then raise exception 'Tienda no disponible'; end if;

  order_code := 'PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders(store_id, code, customer_name, customer_phone, fulfillment, notes, total, checkout)
  values (store_row.id, order_code, btrim(p_customer_name), btrim(p_customer_phone), btrim(p_fulfillment), nullif(btrim(coalesce(p_notes, '')), ''), 0,
    jsonb_build_object('customerName', btrim(p_customer_name), 'customerPhone', btrim(p_customer_phone), 'fulfillment', btrim(p_fulfillment), 'notes', nullif(btrim(coalesce(p_notes, '')), '')))
  returning id into created_order_id;

  order_total := 0;
  for item in select value from jsonb_array_elements(p_items) loop
    if not (item ? 'productId') or (item->>'productId') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Producto inválido'; end if;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 99 then raise exception 'Cantidad inválida'; end if;

    select p.* into product_row from public.products p where p.id = (item->>'productId')::uuid and p.store_id = store_row.id and p.is_visible for update;
    if not found then raise exception 'Producto no disponible'; end if;
    if product_row.stock_quantity is not null and item_quantity > product_row.stock_quantity then raise exception 'Stock insuficiente para %', product_row.name; end if;

    selected_ids := case when jsonb_typeof(item->'selectedOptionIds') = 'array' then item->'selectedOptionIds' else '[]'::jsonb end;
    select count(*) into valid_selected_count from public.product_options o join public.option_groups g on g.id = o.option_group_id where g.product_id = product_row.id and o.is_available and o.id::text in (select jsonb_array_elements_text(selected_ids));
    if valid_selected_count <> jsonb_array_length(selected_ids) then raise exception 'Opción inválida para %', product_row.name; end if;

    unit_price := case when product_row.promo_price is not null then product_row.promo_price else product_row.base_price end;
    item_options := '[]'::jsonb;
    for group_row in select * from public.option_groups where product_id = product_row.id order by sort_order loop
      select count(*) into selected_count from public.product_options o where o.option_group_id = group_row.id and o.is_available and o.id::text in (select jsonb_array_elements_text(selected_ids));
      if group_row.is_required and selected_count < group_row.min_selections then raise exception 'Falta seleccionar %', group_row.name; end if;
      if group_row.selection_type = 'SINGLE' and selected_count > 1 then raise exception 'Solo se puede elegir una opción en %', group_row.name; end if;
      if group_row.max_selections is not null and selected_count > group_row.max_selections then raise exception 'Demasiadas opciones en %', group_row.name; end if;

      for option_row in select o.* from public.product_options o where o.option_group_id = group_row.id and o.is_available and o.id::text in (select jsonb_array_elements_text(selected_ids)) loop
        unit_price := unit_price + option_row.price_delta;
        item_options := item_options || jsonb_build_array(jsonb_build_object('groupName', group_row.name, 'optionName', option_row.name, 'priceDelta', option_row.price_delta));
      end loop;
    end loop;

    item_subtotal := unit_price * item_quantity;
    order_total := order_total + item_subtotal;
    insert into public.order_items(order_id, product_id, product_name, quantity, unit_price, options, subtotal)
    values (created_order_id, product_row.id, product_row.name, item_quantity, unit_price, item_options, item_subtotal);
  end loop;

  update public.orders set total = order_total where id = created_order_id;
  return query select created_order_id, order_code, order_total, store_row.name, store_row.whatsapp_phone,
    coalesce((select jsonb_agg(jsonb_build_object('productName', oi.product_name, 'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'options', oi.options, 'subtotal', oi.subtotal) order by oi.id) from public.order_items oi where oi.order_id = created_order_id), '[]'::jsonb);
exception when invalid_text_representation then
  raise exception 'Datos de pedido inválidos';
end;
$$;

revoke execute on function public.create_public_order(text, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.create_public_order(text, text, text, text, text, jsonb) to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media', 'catalog-media', true, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "owners can upload catalog media" on storage.objects for insert to authenticated with check (
  bucket_id = 'catalog-media' and exists (
    select 1
    from (select id, owner_id from public.stores) s
    where name like 'stores/' || s.id::text || '/%'
      and s.owner_id::text = (select auth.uid()::text)
  )
);
create policy "owners can update catalog media" on storage.objects for update to authenticated using (
  bucket_id = 'catalog-media'
  and owner_id::text = (select auth.uid()::text)
) with check (
  bucket_id = 'catalog-media'
  and owner_id::text = (select auth.uid()::text)
);

create policy "owners can delete catalog media" on storage.objects for delete to authenticated using (
  bucket_id = 'catalog-media'
  and owner_id::text = (select auth.uid()::text)
);
