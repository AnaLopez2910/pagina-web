import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, OptionGroupRow, ProductOptionRow, ProductRow, StoreRow } from "@/types/database";
import { getPublicImageUrl } from "@/lib/storage";

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  imageUrls: string[];
  stockQuantity: number | null;
  category: { id: string; name: string; slug: string } | null;
  optionGroups: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
    maxSelections: number | null;
    options: Array<{ id: string; name: string; priceDelta: number; isAvailable: boolean }>;
  }>;
};

export type PublicStore = {
  name: string;
  slug: string;
  description: string | null;
  whatsappPhone: string;
  address: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrls: string[];
  logoUrl: string | null;
  categories: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>;
  showCategories: boolean;
  mobileProductColumns: 1 | 2;
  freeShipping: { enabled: boolean; threshold: number };
  availability: { isOpen: boolean; label: string };
};

function mapProduct(
  product: ProductRow,
  categories: Map<string, CategoryRow>,
  groups: OptionGroupRow[],
  options: ProductOptionRow[]
): StorefrontProduct {
  const category = product.category_id ? categories.get(product.category_id) : undefined;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    basePrice: product.base_price,
    promoPrice: product.promo_price,
    imageUrls: product.image_paths.map(getPublicImageUrl),
    stockQuantity: product.stock_quantity,
    category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
    optionGroups: groups
      .filter((group) => group.product_id === product.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((group) => ({
        id: group.id,
        name: group.name,
        selectionType: group.selection_type,
        isRequired: group.is_required,
        maxSelections: group.max_selections,
        options: options
          .filter((option) => option.option_group_id === group.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((option) => ({
            id: option.id,
            name: option.name,
            priceDelta: option.price_delta,
            isAvailable: option.is_available
          }))
      }))
  };
}

export async function getPublicStore(slug?: string) {
  const supabase = await createClient();
  let query = supabase.from("stores").select("id,name,slug,description,whatsapp_phone,logo_path,hero_title,hero_subtitle,hero_image_paths,address,business_hours,restrict_by_schedule,show_categories,mobile_product_columns,free_shipping_enabled,free_shipping_threshold,is_published,created_at,updated_at").eq("is_published", true);
  if (slug) {
    query = query.eq("slug", slug);
  }
  const { data: store } = await query.maybeSingle();
  if (!store) {
    return null;
  }

  const [{ data: categories = [] }, { data: products = [] }] = await Promise.all([
    supabase.from("categories").select("*").eq("store_id", store.id).order("sort_order"),
    supabase.from("products").select("*").eq("store_id", store.id).eq("is_visible", true).order("sort_order")
  ]);
  const typedCategories = categories as CategoryRow[];
  const typedProducts = products as ProductRow[];
  const productIds = typedProducts.map((product) => product.id);
  const { data: groups = [] } = productIds.length
    ? await supabase.from("option_groups").select("*").in("product_id", productIds).order("sort_order")
    : { data: [] as OptionGroupRow[] };
  const groupIds = (groups as OptionGroupRow[]).map((group) => group.id);
  const { data: options = [] } = groupIds.length
    ? await supabase.from("product_options").select("*").in("option_group_id", groupIds).order("sort_order")
    : { data: [] as ProductOptionRow[] };

  const { getStoreAvailability } = await import("@/lib/store-settings");
  return {
    store: mapStore(store as StoreRow, typedCategories),
    products: typedProducts.map((product) => mapProduct(product, new Map(typedCategories.map((category) => [category.id, category])), groups as OptionGroupRow[], options as ProductOptionRow[])),
    availability: getStoreAvailability({ restrictBySchedule: store.restrict_by_schedule, businessHours: store.business_hours })
  };
}

function mapStore(store: StoreRow, categories: CategoryRow[]): PublicStore {
  return {
    name: store.name,
    slug: store.slug,
    description: store.description,
    whatsappPhone: store.whatsapp_phone,
    address: store.address,
    heroTitle: store.hero_title,
    heroSubtitle: store.hero_subtitle,
    heroImageUrls: store.hero_image_paths.map(getPublicImageUrl),
    logoUrl: store.logo_path ? getPublicImageUrl(store.logo_path) : null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      imageUrl: category.image_path ? getPublicImageUrl(category.image_path) : null
    })),
    showCategories: store.show_categories,
    mobileProductColumns: store.mobile_product_columns === 1 ? 1 : 2,
    freeShipping: {
      enabled: store.free_shipping_enabled,
      threshold: store.free_shipping_threshold
    },
    availability: { isOpen: true, label: "" }
  };
}

export async function getPublicProduct(storeSlug: string, productSlug: string) {
  const catalog = await getPublicStore(storeSlug);
  if (!catalog) {
    return null;
  }
  return catalog.products.find((product) => product.slug === productSlug) ?? null;
}
