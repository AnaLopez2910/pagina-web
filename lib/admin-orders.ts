import type { getMerchantContext } from "@/lib/merchant";
import type { Json } from "@/types/database";

type MerchantSupabase = Awaited<ReturnType<typeof getMerchantContext>>["supabase"];

export async function buildAdminOrderItem(
  supabase: MerchantSupabase,
  storeId: string,
  productId: string,
  quantity: number,
  selectedOptionIds: string[]
) {
  const { data: product, error: productError } = await supabase.from("products").select("*").eq("id", productId).eq("store_id", storeId).maybeSingle();
  if (productError || !product) throw new Error("El producto elegido no está disponible.");

  const { data: groupsData, error: groupsError } = await supabase.from("option_groups").select("*").eq("product_id", productId).order("sort_order");
  if (groupsError) throw new Error("No se pudieron leer las variantes del producto.");
  const groups = groupsData ?? [];
  const groupIds = groups.map((group) => group.id);
  const { data: optionsData, error: optionsError } = groupIds.length
    ? await supabase.from("product_options").select("*").in("option_group_id", groupIds).order("sort_order")
    : { data: null, error: null };
  if (optionsError) throw new Error("No se pudieron leer las variantes del producto.");
  const options = optionsData ?? [];

  const selectedOptions = options.filter((option) => selectedOptionIds.includes(option.id) && option.is_available);
  if (selectedOptions.length !== selectedOptionIds.length) throw new Error(`Hay una variante inválida para ${product.name}.`);

  let unitPrice = product.promo_price ?? product.base_price;
  const itemOptions = [] as Array<{ groupName: string; optionName: string; priceDelta: number }>;
  for (const group of groups) {
    const groupOptions = selectedOptions.filter((option) => option.option_group_id === group.id);
    if (group.is_required && groupOptions.length < group.min_selections) throw new Error(`Falta seleccionar ${group.name}.`);
    if (group.selection_type === "SINGLE" && groupOptions.length > 1) throw new Error(`Solo se puede elegir una opción en ${group.name}.`);
    if (group.max_selections !== null && groupOptions.length > group.max_selections) throw new Error(`Demasiadas opciones en ${group.name}.`);
    for (const option of groupOptions) {
      unitPrice += option.price_delta;
      itemOptions.push({ groupName: group.name, optionName: option.name, priceDelta: option.price_delta });
    }
  }

  return {
    product_id: product.id,
    product_name: product.name,
    quantity,
    unit_price: unitPrice,
    purchase_price: product.purchase_price,
    options: itemOptions as Json,
    subtotal: unitPrice * quantity
  };
}
