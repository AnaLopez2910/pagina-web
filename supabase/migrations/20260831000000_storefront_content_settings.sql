begin;

alter table public.stores
  add column hero_image_paths text[] not null default '{}',
  add column show_categories boolean not null default true,
  add column mobile_product_columns smallint not null default 2,
  add column free_shipping_enabled boolean not null default false,
  add column free_shipping_threshold integer not null default 35000;

alter table public.stores
  add constraint stores_hero_image_paths_max_check
    check (coalesce(array_length(hero_image_paths, 1), 0) <= 3),
  add constraint stores_mobile_product_columns_check
    check (mobile_product_columns in (1, 2)),
  add constraint stores_free_shipping_threshold_check
    check (free_shipping_threshold > 0);

alter table public.categories
  add column image_path text;

commit;
