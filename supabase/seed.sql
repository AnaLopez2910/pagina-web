-- Carga datos demo para el primer usuario de Supabase si ya existe.
-- En producción, reemplazá estos datos por los productos reales.
do $$
declare
  seed_owner uuid;
  seed_store uuid;
  seed_category uuid;
begin
  select id into seed_owner from auth.users order by created_at limit 1;
  if seed_owner is null then
    return;
  end if;

  insert into public.stores (owner_id, name, slug, description, whatsapp_phone, hero_title, hero_subtitle)
  values (seed_owner, 'Pestañas Ana', 'pestanas-ana', 'Pestañas, maquillaje y accesorios para tus rituales de belleza.', '541100000000', 'Brillá a tu manera', 'Tus favoritos de belleza, listos para vos.')
  on conflict (owner_id) do update set name = excluded.name
  returning id into seed_store;

  insert into public.categories (store_id, name, slug, sort_order)
  values (seed_store, 'Pestañas', 'pestanas', 0)
  on conflict (store_id, slug) do update set name = excluded.name
  returning id into seed_category;

  insert into public.products (store_id, category_id, name, slug, description, base_price, promo_price, purchase_price)
  values (seed_store, seed_category, 'Pestañas efecto natural', 'pestanas-efecto-natural', 'Volumen delicado para una mirada luminosa todos los días.', 8500, 6900, 4000)
  on conflict (store_id, slug) do update set description = excluded.description, purchase_price = excluded.purchase_price;
end;
$$;
