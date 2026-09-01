import { NextResponse } from "next/server";

import {
  makeProductSlug,
  normalizeImagePaths,
  normalizePromoPrice,
  normalizePurchasePrice,
  parseProductRequest,
  productSchema,
  deleteProductImages,
  uploadProductImages,
  validateProductImageFiles
} from "@/lib/admin-catalog";
import { getAdminProducts } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";

type Params = Promise<{ productId: string }>;

async function saveOptionGroups(supabase: Awaited<ReturnType<typeof getMerchantContext>>["supabase"], productId: string, groups: ReturnType<typeof productSchema.parse>["optionGroups"]) {
  const { error: deleteError } = await supabase.from("option_groups").delete().eq("product_id", productId);
  if (deleteError) throw new Error("No se pudieron actualizar las opciones.");
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

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { productId } = await params;
  const { data: existing } = await supabase.from("products").select("*").eq("id", productId).eq("store_id", store.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

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
  let categoryId: string | null = null;
  try {
    promoPrice = normalizePromoPrice(result.data.promoPrice, basePrice);
    purchasePrice = normalizePurchasePrice(result.data.purchasePrice);
    if (result.data.categoryId && result.data.categoryId !== "none") {
      const { data: category } = await supabase.from("categories").select("id").eq("id", result.data.categoryId).eq("store_id", store.id).maybeSingle();
      if (!category) throw new Error("Categoría inválida.");
      categoryId = category.id;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  const slug = result.data.name.trim() === existing.name ? existing.slug : makeProductSlug(result.data.name);
  const { data: collision } = await supabase.from("products").select("id").eq("store_id", store.id).eq("slug", slug).neq("id", productId).maybeSingle();
  if (collision) return NextResponse.json({ error: "Ya existe un producto con ese nombre." }, { status: 409 });

  let uploadedImages: string[] = [];
  try {
    uploadedImages = parsedRequest.imageFiles.length ? await uploadProductImages(store.id, parsedRequest.imageFiles) : [];
    const imagePaths = [...normalizeImagePaths(result.data, store.id), ...uploadedImages].slice(0, 6);
    const { error } = await supabase.from("products").update({
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
    }).eq("id", productId).eq("store_id", store.id);
    if (error) throw new Error("No se pudo guardar el producto.");
    await saveOptionGroups(supabase, productId, result.data.optionGroups);
    const removed = existing.image_paths.filter((path) => !imagePaths.includes(path));
    await deleteProductImages(supabase, store.id, removed);
    const products = await getAdminProducts(supabase, store.id);
    return NextResponse.json({ product: products.find((item) => item.id === productId) });
  } catch (error) {
    if (uploadedImages.length) await supabase.storage.from("catalog-media").remove(uploadedImages);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el producto." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { productId } = await params;
  const { data: product } = await supabase.from("products").select("image_paths").eq("id", productId).eq("store_id", store.id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", store.id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar el producto." }, { status: 500 });
  try {
    await deleteProductImages(supabase, store.id, product.image_paths);
  } catch (cleanupError) {
    return NextResponse.json({ error: cleanupError instanceof Error ? cleanupError.message : "No se pudieron eliminar las imágenes del producto." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
