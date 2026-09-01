begin;

grant execute on function public.create_public_order(text, text, text, text, text, jsonb) to anon, authenticated;

commit;
