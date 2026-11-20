import { NextResponse } from "next/server";
import { z } from "zod";

import {
  normalizeImagePaths,
  normalizePromoPrice,
  normalizePurchasePrice,
  parseProductRequest,
  productSchema,
  resolveProductCategoryId,
  deleteProductImages,
  uploadProductImages,
  validateProductImageFiles
} from "@/lib/admin-catalog";
import { getAdminProducts } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { buildProductSlug, createProductCode, productSlugCode } from "@/lib/product-url";

type Params = Promise<{ productId: string }>;

const quickProductUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("visibility"), isVisible: z.boolean() }),
  z.object({
    action: z.literal("price-stock"),
    basePrice: z.union([z.number(), z.string()]),
    promoPrice: z.union([z.number(), z.string()]).nullable(),
    stockQuantity: z.union([z.number().int().min(0).max(999999), z.string()]).nullable()
  }),
  z.object({
    action: z.literal("category"),
    categoryId: z.string().nullable(),
    categoryName: z.string().trim().min(2).max(80).optional()
  })
]).superRefine((value, context) => {
  if (value.action === "category" && value.categoryId === "__new" && !value.categoryName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryName"], message: "Ingresá el nombre de la nueva categoría." });
  }
});

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
      // Only sent when set, so saving keeps working on databases without the colour migration.
      ...(option.colorHex ? { color_hex: option.colorHex } : {}),
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
  const quickUpdate = quickProductUpdateSchema.safeParse(parsedRequest.body);
  if (quickUpdate.success) {
    let updates: {
      is_visible?: boolean;
      category_id?: string | null;
      base_price?: number;
      promo_price?: number | null;
      stock_quantity?: number | null;
    };
    if (quickUpdate.data.action === "visibility") {
      updates = { is_visible: quickUpdate.data.isVisible };
    } else if (quickUpdate.data.action === "price-stock") {
      const basePrice = parsePriceToCents(String(quickUpdate.data.basePrice));
      if (basePrice <= 0) return NextResponse.json({ error: "El precio debe ser mayor a cero." }, { status: 400 });
      let promoPrice: number | null;
      try {
        promoPrice = normalizePromoPrice(quickUpdate.data.promoPrice, basePrice);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Precio promocional inválido." }, { status: 400 });
      }
      const rawStock = quickUpdate.data.stockQuantity;
      const normalizedStock = rawStock === null ? null : String(rawStock);
      if (normalizedStock !== null && !/^\d{1,6}$/.test(normalizedStock)) {
        return NextResponse.json({ error: "Ingresá un stock válido." }, { status: 400 });
      }
      updates = {
        base_price: basePrice,
        promo_price: promoPrice,
        stock_quantity: normalizedStock === null ? null : Number(normalizedStock)
      };
    } else {
      try {
        updates = {
          category_id: await resolveProductCategoryId(
            supabase,
            store.id,
            quickUpdate.data.categoryId,
            quickUpdate.data.categoryName
          )
        };
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
      }
    }

    const { error } = await supabase.from("products").update(updates).eq("id", productId).eq("store_id", store.id);
    if (error) return NextResponse.json({ error: "No se pudo actualizar el producto." }, { status: 500 });
    const products = await getAdminProducts(supabase, store.id);
    return NextResponse.json({ product: products.find((item) => item.id === productId) });
  }
  if (typeof parsedRequest.body === "object" && parsedRequest.body !== null && "action" in parsedRequest.body) {
    return NextResponse.json({ error: quickUpdate.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

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
    categoryId = await resolveProductCategoryId(supabase, store.id, result.data.categoryId, result.data.categoryName);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
  }

  // A rename keeps the product's code, so links shared before still find it.
  let slug = buildProductSlug(result.data.name, productSlugCode(existing.slug) ?? createProductCode());
  const { data: collision } = await supabase.from("products").select("id").eq("store_id", store.id).eq("slug", slug).neq("id", productId).maybeSingle();
  if (collision) slug = buildProductSlug(result.data.name, createProductCode());

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
