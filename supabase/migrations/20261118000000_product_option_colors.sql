begin;

-- Optional swatch colour per product option, shown as a colour circle in the storefront.
alter table public.product_options
  add column color_hex text;

alter table public.product_options
  add constraint product_options_color_hex_check
    check (color_hex is null or color_hex ~ '^#[0-9a-fA-F]{6}$');

commit;
