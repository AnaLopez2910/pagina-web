begin;

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
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 2 and 100 then
    raise exception 'Nombre inválido';
  end if;
  if char_length(btrim(coalesce(p_customer_phone, ''))) not between 6 and 40 then
    raise exception 'Teléfono inválido';
  end if;
  if char_length(btrim(coalesce(p_fulfillment, ''))) not between 2 and 80 then
    raise exception 'Modalidad inválida';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'Notas demasiado largas';
  end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' then
    raise exception 'El pedido no tiene productos válidos';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 80 then
    raise exception 'El pedido no tiene productos válidos';
  end if;

  select * into store_row
  from public.stores
  where slug = btrim(p_store_slug) and is_published
  for update;
  if not found then
    raise exception 'Tienda no disponible';
  end if;

  loop
    order_code := 'PED-' || upper(substr(md5(clock_timestamp()::text || random()::text || coalesce(p_customer_phone, '')), 1, 8));
    exit when not exists (
      select 1 from public.orders o where o.store_id = store_row.id and o.code = order_code
    );
  end loop;

  insert into public.orders(store_id, code, customer_name, customer_phone, fulfillment, notes, total, checkout)
  values (
    store_row.id,
    order_code,
    btrim(p_customer_name),
    btrim(p_customer_phone),
    btrim(p_fulfillment),
    nullif(btrim(coalesce(p_notes, '')), ''),
    0,
    jsonb_build_object(
      'customerName', btrim(p_customer_name),
      'customerPhone', btrim(p_customer_phone),
      'fulfillment', btrim(p_fulfillment),
      'notes', nullif(btrim(coalesce(p_notes, '')), '')
    )
  )
  returning id into created_order_id;

  order_total := 0;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Producto inválido';
    end if;
    if coalesce(item->>'productId', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'Producto inválido';
    end if;
    if coalesce(item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception 'Cantidad inválida';
    end if;
    item_quantity := (item->>'quantity')::integer;
    if item_quantity < 1 or item_quantity > 99 then
      raise exception 'Cantidad inválida';
    end if;
    if item ? 'selectedOptionIds' and jsonb_typeof(item->'selectedOptionIds') <> 'array' then
      raise exception 'Opciones inválidas';
    end if;

    select p.* into product_row
    from public.products p
    where p.id = (item->>'productId')::uuid
      and p.store_id = store_row.id
      and p.is_visible
    for update;
    if not found then
      raise exception 'Producto no disponible';
    end if;
    if product_row.stock_quantity is not null and item_quantity > product_row.stock_quantity then
      raise exception 'Stock insuficiente para %', product_row.name;
    end if;

    selected_ids := case
      when jsonb_typeof(item->'selectedOptionIds') = 'array' then item->'selectedOptionIds'
      else '[]'::jsonb
    end;
    select count(*) into valid_selected_count
    from public.product_options o
    join public.option_groups g on g.id = o.option_group_id
    where g.product_id = product_row.id
      and o.is_available
      and o.id::text in (select jsonb_array_elements_text(selected_ids));
    if valid_selected_count <> jsonb_array_length(selected_ids) then
      raise exception 'Opción inválida para %', product_row.name;
    end if;

    unit_price := case when product_row.promo_price is not null then product_row.promo_price else product_row.base_price end;
    item_options := '[]'::jsonb;
    for group_row in
      select * from public.option_groups where product_id = product_row.id order by sort_order
    loop
      select count(*) into selected_count
      from public.product_options o
      where o.option_group_id = group_row.id
        and o.is_available
        and o.id::text in (select jsonb_array_elements_text(selected_ids));
      if group_row.is_required and selected_count < group_row.min_selections then
        raise exception 'Falta seleccionar %', group_row.name;
      end if;
      if group_row.selection_type = 'SINGLE' and selected_count > 1 then
        raise exception 'Solo se puede elegir una opción en %', group_row.name;
      end if;
      if group_row.max_selections is not null and selected_count > group_row.max_selections then
        raise exception 'Demasiadas opciones en %', group_row.name;
      end if;

      for option_row in
        select o.*
        from public.product_options o
        where o.option_group_id = group_row.id
          and o.is_available
          and o.id::text in (select jsonb_array_elements_text(selected_ids))
      loop
        unit_price := unit_price + option_row.price_delta;
        item_options := item_options || jsonb_build_array(
          jsonb_build_object(
            'groupName', group_row.name,
            'optionName', option_row.name,
            'priceDelta', option_row.price_delta
          )
        );
      end loop;
    end loop;

    item_subtotal := unit_price * item_quantity;
    order_total := order_total + item_subtotal;
    insert into public.order_items(order_id, product_id, product_name, quantity, unit_price, purchase_price, options, subtotal)
    values (created_order_id, product_row.id, product_row.name, item_quantity, unit_price, product_row.purchase_price, item_options, item_subtotal);
  end loop;

  update public.orders set total = order_total where id = created_order_id;
  return query
  select
    created_order_id,
    order_code,
    order_total,
    store_row.name,
    store_row.whatsapp_phone,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'productName', oi.product_name,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'options', oi.options,
            'subtotal', oi.subtotal
          ) order by oi.id
        )
        from public.order_items oi
        where oi.order_id = created_order_id
      ),
      '[]'::jsonb
    );
exception
  when invalid_text_representation then
    raise exception 'Datos de pedido inválidos';
end;
$$;

revoke execute on function public.create_public_order(text, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.create_public_order(text, text, text, text, text, jsonb) to anon, authenticated;

commit;
