import { NextResponse } from "next/server";

import {
  makeProductSlug,
  normalizeImagePaths,
  normalizePromoPrice,
  normalizePurchasePrice,
  parseProductRequest,
  productSchema,
  uploadProductImages,
  validateProductImageFiles
} from "@/lib/admin-catalog";
import { getAdminProducts } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";

async function resolveCategoryId(supabase: Awaited<ReturnType<typeof getMerchantContext>>["supabase"], storeId: string, categoryId: string | null | undefined, categoryName: string | null | undefined) {
  if (categoryId && categoryId !== "none") {
    const { data } = await supabase.from("categories").select("id").eq("id", categoryId).eq("store_id", storeId).maybeSingle();
    if (!data) throw new Error("Categoría inválida.");
    return data.id;
  }
  const name = categoryName?.trim();
  if (!name) return null;
  const slug = makeProductSlug(name);
  const { data: existing } = await supabase.from("categories").select("id").eq("store_id", storeId).eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("categories").insert({ store_id: storeId, name, slug }).select("id").single();
  if (error || !data) throw new Error("No se pudo crear la categoría.");
  return data.id;
}

async function createOptionGroups(supabase: Awaited<ReturnType<typeof getMerchantContext>>["supabase"], productId: string, groups: ReturnType<typeof productSchema.parse>["optionGroups"]) {
  for (const [groupIndex, group] of groups.entries()) {
    if (!group.name.trim() || group.options.length === 0) continue;
    const { data: createdGroup, error: groupError } = await supabase.from("option_groups").insert({
      product_id: productId,
      name: group.name.trim(),
      selection_type: group.selectionType,
      is_required: group.isRequired,
      min_selections: group.isRequired ? 1 : 0,
      max_selections: group.selectionType === "MULTIPLE" ? group.maxSelections : 1,
      sort_order: groupIndex
    }).select("id").single();
    if (groupError || !createdGroup) throw new Error("No se pudieron guardar las opciones.");
    const { error: optionError } = await supabase.from("product_options").insert(group.options.map((option, optionIndex) => ({
      option_group_id: createdGroup.id,
      name: option.name.trim(),
      price_delta: parsePriceToCents(String(option.priceDelta)),
      is_available: option.isAvailable,
      sort_order: optionIndex
    })));
    if (optionError) throw new Error("No se pudieron guardar las opciones.");
  }
}

export async function GET() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ products: await getAdminProducts(supabase, store.id) });
}

export async function POST(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsedRequest = await parseProductRequest(request).catch(() => ({ body: null, imageFiles: [] as File[] }));
  const result = productSchema.safeParse(parsedRequest.body);
  if (!result.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const imageError = validateProductImageFiles(parsedRequest.imageFiles);
  if (imageError || result.data.imagePaths.length + parsedRequest.imageFiles.length > 6) {
    return NextResponse.json({ error: imageError ?? "El máximo es 6 imágenes por producto." }, { status: 400 });
  }

  const basePrice = parsePriceToCents(String(result.data.basePrice));
  if (basePrice <= 0) return NextResponse.json({ error: "El precio debe ser mayor a cero." }, { status: 400 });
  let promoPrice: number | null;
  let purchasePrice: number;
  let categoryId: string | null;
  try {
    promoPrice = normalizePromoPrice(result.data.promoPrice, basePrice);
    purchasePrice = normalizePurchasePrice(result.data.purchasePrice);
    categoryId = await resolveCategoryId(supabase, store.id, result.data.categoryId, result.data.categoryName);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const baseSlug = makeProductSlug(result.data.name);
  const { data: collision } = await supabase.from("products").select("id").eq("store_id", store.id).eq("slug", baseSlug).maybeSingle();
  const slug = collision ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  let uploadedImages: string[] = [];
  try {
    uploadedImages = parsedRequest.imageFiles.length ? await uploadProductImages(store.id, parsedRequest.imageFiles) : [];
    const imagePaths = [...normalizeImagePaths(result.data, store.id), ...uploadedImages].slice(0, 6);
    const { data: product, error } = await supabase.from("products").insert({
      store_id: store.id,
      category_id: categoryId,
      name: result.data.name.trim(),
      slug,
      description: result.data.description?.trim() || null,
      base_price: basePrice,
      promo_price: promoPrice,
      purchase_price: purchasePrice,
      image_paths: imagePaths,
      is_visible: result.data.isVisible,
      stock_quantity: result.data.stockQuantity
    }).select("id").single();
    if (error || !product) throw new Error("No se pudo guardar el producto.");
    await createOptionGroups(supabase, product.id, result.data.optionGroups);
    const products = await getAdminProducts(supabase, store.id);
    return NextResponse.json({ product: products.find((item) => item.id === product.id) });
  } catch (error) {
    if (uploadedImages.length) await supabase.storage.from("catalog-media").remove(uploadedImages);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el producto." }, { status: 500 });
  }
}
