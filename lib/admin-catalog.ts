import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getMerchantContext } from "@/lib/merchant";
import { parsePriceToCents } from "@/lib/money";
import { imageExtension, isSafeImagePath, MEDIA_BUCKET, getPublicImageUrl } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { ProductRow } from "@/types/database";

const nullableStockQuantity = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const normalized = String(value).replace(/\D/g, "");
    return normalized ? Number(normalized) : null;
  },
  z.number().int().min(0).max(999999).nullable()
);

const optionGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  selectionType: z.enum(["SINGLE", "MULTIPLE"]),
  isRequired: z.boolean().default(false),
  maxSelections: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(1).max(30).nullable()
  ).default(null),
  options: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    priceDelta: z.union([z.number(), z.string()]).default(0),
    isAvailable: z.boolean().default(true)
  })).max(30)
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(800).optional().nullable(),
  basePrice: z.union([z.number(), z.string()]),
  promoPrice: z.union([z.number(), z.string()]).optional().nullable(),
  purchasePrice: z.union([z.number(), z.string()]),
  imagePaths: z.array(z.string()).max(6).default([]),
  imageUrls: z.array(z.string()).max(6).default([]),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().max(80).optional().nullable(),
  isVisible: z.boolean().default(true),
  stockQuantity: nullableStockQuantity.default(null),
  optionGroups: z.array(optionGroupSchema).max(12).default([])
});

export type ProductPayload = z.infer<typeof productSchema>;

export async function parseProductRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), imageFiles: [] as File[] };
  }
  const formData = await request.formData().catch(() => null);
  if (!formData) return { body: null, imageFiles: [] as File[] };
  const payload = formData.get("payload");
  let body: unknown = null;
  if (typeof payload === "string") body = JSON.parse(payload);
  const imageFiles = formData.getAll("images").filter((file): file is File => file instanceof File && file.size > 0);
  return { body, imageFiles };
}

export function validateProductImageFiles(files: File[]) {
  for (const file of files) {
    if (!imageExtension(file.type)) return "Formato de imagen no soportado.";
    if (file.size > 6 * 1024 * 1024) return "Cada imagen no puede superar 6 MB.";
  }
  return null;
}

export async function uploadProductImages(storeId: string, files: File[]) {
  const { supabase, user } = await getMerchantContext();
  if (!user) throw new Error("No autorizado");
  const uploaded: string[] = [];
  for (const file of files) {
    const extension = imageExtension(file.type);
    if (!extension) throw new Error("Formato de imagen no soportado.");
    const path = `stores/${storeId}/products/${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (uploaded.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploaded);
      throw error;
    }
    uploaded.push(path);
  }
  return uploaded;
}

export async function deleteProductImages(
  supabase: Awaited<ReturnType<typeof getMerchantContext>>["supabase"],
  storeId: string,
  imagePaths: string[]
) {
  const safePaths = imagePaths.filter((path) => isSafeImagePath(path, storeId));
  if (!safePaths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(safePaths);
  if (error) {
    console.error("catalog media cleanup failed", { storeId, paths: safePaths, message: error.message });
    throw new Error("No se pudieron eliminar las imágenes del producto.");
  }
}

export function normalizeImagePaths(input: Pick<ProductPayload, "imagePaths" | "imageUrls">, storeId: string) {
  const legacyPaths = input.imageUrls
    .filter((url) => url.includes(`/storage/v1/object/public/${MEDIA_BUCKET}/`))
    .map((url) => url.split(`/storage/v1/object/public/${MEDIA_BUCKET}/`)[1] ?? "")
    .filter((path) => isSafeImagePath(path, storeId));
  return Array.from(new Set([
    ...input.imagePaths.filter((path) => isSafeImagePath(path, storeId)),
    ...legacyPaths
  ])).slice(0, 6);
}

export function normalizePromoPrice(value: ProductPayload["promoPrice"], basePrice: number) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const promoPrice = parsePriceToCents(String(value));
  if (promoPrice <= 0) return null;
  if (promoPrice >= basePrice) throw new Error("El precio promocional debe ser menor al precio base.");
  return promoPrice;
}

export function normalizePurchasePrice(value: ProductPayload["purchasePrice"]) {
  const raw = String(value ?? "").replace(/\s/g, "").replace(/^\$/, "").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, "");
  const number = Number(normalized);
  if (!raw || !Number.isFinite(number) || number < 0) {
    throw new Error("Ingresá un precio de compra válido.");
  }
  return Math.round(number);
}

export function makeProductSlug(name: string) {
  return slugify(name) || `producto-${randomUUID().slice(0, 8)}`;
}

export function productForClient(product: ProductRow & { category?: unknown; optionGroups?: unknown[] }) {
  return {
    ...product,
    imageUrls: product.image_paths.map(getPublicImageUrl),
    basePrice: product.base_price,
    promoPrice: product.promo_price,
    purchasePrice: product.purchase_price,
    stockQuantity: product.stock_quantity,
    category: product.category ?? null,
    optionGroups: product.optionGroups ?? []
  };
}
