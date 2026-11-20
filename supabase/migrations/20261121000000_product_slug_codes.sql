-- Product URLs become "<name>-<code>": a short code that never changes, so two products
-- can share a name and shared links survive renames. New products get their code from
-- the app; this gives one to every existing product.
begin;

do $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  product record;
  code text;
begin
  for product in
    select id, store_id, slug from public.products
    where not (slug ~ '-[0-9a-z]{5}$' and right(slug, 5) ~ '[0-9]')
  loop
    loop
      code := '';
      for i in 1..5 loop
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when code ~ '[0-9]'
        and not exists (select 1 from public.products where store_id = product.store_id and slug = product.slug || '-' || code);
    end loop;
    update public.products set slug = product.slug || '-' || code where id = product.id;
  end loop;
end $$;

commit;
