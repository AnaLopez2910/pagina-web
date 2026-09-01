import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicImageUrl } from "@/lib/storage";
import type { Database, CategoryRow, OptionGroupRow, ProductOptionRow, ProductRow, OrderItemRow, OrderRow } from "@/types/database";

export async function getAdminProducts(supabase: SupabaseClient<Database>, storeId: string) {
  const [{ data: products = [] }, { data: categories = [] }] = await Promise.all([
    supabase.from("products").select("*").eq("store_id", storeId).order("sort_order"),
    supabase.from("categories").select("*").eq("store_id", storeId).order("sort_order")
  ]);
  const typedProducts = products as ProductRow[];
  const typedCategories = categories as CategoryRow[];
  const productIds = typedProducts.map((product) => product.id);
  const { data: groups = [] } = productIds.length
    ? await supabase.from("option_groups").select("*").in("product_id", productIds).order("sort_order")
    : { data: [] as OptionGroupRow[] };
  const groupIds = (groups as OptionGroupRow[]).map((group) => group.id);
  const { data: options = [] } = groupIds.length
    ? await supabase.from("product_options").select("*").in("option_group_id", groupIds).order("sort_order")
    : { data: [] as ProductOptionRow[] };

  return typedProducts.map((product) => {
    const category = typedCategories.find((item) => item.id === product.category_id);
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.base_price,
      promoPrice: product.promo_price,
      purchasePrice: product.purchase_price,
      imageUrls: product.image_paths.map(getPublicImageUrl),
      isVisible: product.is_visible,
      stockQuantity: product.stock_quantity,
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      optionGroups: (groups as OptionGroupRow[])
        .filter((group) => group.product_id === product.id)
        .map((group) => ({
          id: group.id,
          name: group.name,
          selectionType: group.selection_type,
          isRequired: group.is_required,
          maxSelections: group.max_selections,
          options: (options as ProductOptionRow[])
            .filter((option) => option.option_group_id === group.id)
            .map((option) => ({ id: option.id, name: option.name, priceDelta: option.price_delta, isAvailable: option.is_available }))
        }))
    };
  });
}

export async function getAdminCategories(supabase: SupabaseClient<Database>, storeId: string) {
  const [{ data: categories = [] }, { data: products = [] }] = await Promise.all([
    supabase.from("categories").select("*").eq("store_id", storeId).order("sort_order"),
    supabase.from("products").select("category_id").eq("store_id", storeId)
  ]);
  const counts = new Map<string, number>();
  for (const product of products as Array<Pick<ProductRow, "category_id">>) {
    if (product.category_id) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
  }
  return (categories as CategoryRow[]).map((category) => ({
    ...category,
    imageUrl: category.image_path ? getPublicImageUrl(category.image_path) : null,
    _count: { products: counts.get(category.id) ?? 0 }
  }));
}

export async function getAdminOrders(supabase: SupabaseClient<Database>, storeId: string) {
  const { data: orders = [] } = await supabase.from("orders").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
  const orderIds = (orders as OrderRow[]).map((order) => order.id);
  const { data: items = [] } = orderIds.length
    ? await supabase.from("order_items").select("*").in("order_id", orderIds)
    : { data: [] as OrderItemRow[] };

  return (orders as OrderRow[]).map((order) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    fulfillment: order.fulfillment,
    total: order.total,
    createdAt: order.created_at,
    items: (items as OrderItemRow[]).filter((item) => item.order_id === order.id).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      purchasePrice: item.purchase_price,
      options: item.options,
      subtotal: item.subtotal
    }))
  }));
}
