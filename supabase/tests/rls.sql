begin;

select plan(13);
select ok((select relrowsecurity from pg_class where oid = 'public.stores'::regclass), 'stores has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'categories has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'products has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders has RLS enabled');
select ok(has_function_privilege('anon', 'public.create_public_order(text,text,text,text,text,jsonb)', 'execute'), 'anon can execute the public order function');
select ok(has_function_privilege('authenticated', 'public.create_public_order(text,text,text,text,text,jsonb)', 'execute'), 'authenticated can execute the public order function');
select ok(not has_table_privilege('anon', 'public.orders', 'insert'), 'anon cannot insert orders directly');
select ok(not has_table_privilege('anon', 'public.order_items', 'insert'), 'anon cannot insert order items directly');
select ok(has_table_privilege('authenticated', 'public.orders', 'delete'), 'authenticated can delete orders');
select ok(not has_table_privilege('anon', 'public.orders', 'delete'), 'anon cannot delete orders directly');
select ok(has_table_privilege('authenticated', 'public.order_items', 'insert'), 'authenticated can insert order items');
select ok(has_table_privilege('authenticated', 'public.order_items', 'update'), 'authenticated can update order items');
select ok(has_table_privilege('authenticated', 'public.order_items', 'delete'), 'authenticated can delete order items');

select * from finish();
rollback;
