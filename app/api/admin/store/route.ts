import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantContext } from "@/lib/merchant";
import { imageExtension, isSafeImagePath, MEDIA_BUCKET, getPublicImageUrl } from "@/lib/storage";
import { isCompleteArgentineLocalPhone, normalizeArgentineWhatsAppPhone, emptyBusinessHours, normalizeBusinessHours } from "@/lib/store-settings";
import { slugify } from "@/lib/slug";
import { parsePriceToCents } from "@/lib/money";

const booleanField = z.preprocess((value) => value === true || value === "true", z.boolean());
const positiveIntegerField = z.preprocess((value) => parsePriceToCents(String(value ?? "")), z.number().int().positive());
const mobileColumnsField = z.preprocess((value) => Number(value), z.union([z.literal(1), z.literal(2)]));

const schema = z.object({
  name: z.string().trim().min(2).max(90),
  description: z.string().max(500).optional().nullable(),
  whatsappPhone: z.string().refine(isCompleteArgentineLocalPhone, "Ingresá un teléfono argentino completo."),
  logoPath: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(220).optional().nullable(),
  heroImagePaths: z.array(z.string().nullable()).max(3).default([]),
  address: z.string().max(180).optional().nullable(),
  showCategories: booleanField.default(true),
  mobileProductColumns: mobileColumnsField.default(2),
  freeShippingEnabled: booleanField.default(false),
  freeShippingThreshold: positiveIntegerField.default(35000),
  restrictBySchedule: booleanField.default(false),
  businessHours: z.unknown().default(emptyBusinessHours())
});

function scalar(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

async function parseRequest(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), logoFile: null as File | null, heroImageFiles: [] as Array<File | null> };
  }
  const formData = await request.formData();
  const hoursValue = scalar(formData, "businessHours");
  return {
    body: {
      name: scalar(formData, "name"),
      description: scalar(formData, "description"),
      whatsappPhone: scalar(formData, "whatsappPhone"),
      logoPath: scalar(formData, "logoPath") ?? "",
      logoUrl: scalar(formData, "logoUrl") ?? "",
      heroTitle: scalar(formData, "heroTitle"),
      heroSubtitle: scalar(formData, "heroSubtitle"),
      heroImagePaths: [0, 1, 2].map((index) => scalar(formData, `heroImagePath${index}`) || null),
      address: scalar(formData, "address"),
      showCategories: scalar(formData, "showCategories") === "true",
      mobileProductColumns: scalar(formData, "mobileProductColumns"),
      freeShippingEnabled: scalar(formData, "freeShippingEnabled") === "true",
      freeShippingThreshold: scalar(formData, "freeShippingThreshold"),
      restrictBySchedule: scalar(formData, "restrictBySchedule") === "true",
      businessHours: hoursValue ? JSON.parse(hoursValue) : emptyBusinessHours()
    },
    logoFile: formData.get("logoFile") instanceof File ? formData.get("logoFile") as File : null,
    heroImageFiles: [0, 1, 2].map((index) => {
      const file = formData.get(`heroImageFile${index}`);
      return file instanceof File && file.size > 0 ? file : null;
    })
  };
}

export async function PATCH(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { body, logoFile, heroImageFiles } = await parseRequest(request).catch(() => ({ body: null, logoFile: null, heroImageFiles: [] as Array<File | null> }));
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  let businessHours;
  try {
    businessHours = normalizeBusinessHours(result.data.businessHours);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Horarios inválidos" }, { status: 400 });
  }

  let logoPath = result.data.logoPath || result.data.logoUrl || null;
  let uploadedLogo: string | null = null;
  const uploadedHeroImages: string[] = [];
  const previousHeroImages = store.hero_image_paths.filter((path) => isSafeImagePath(path, store.id));
  const requestedHeroPaths = result.data.heroImagePaths.map((path) => path && isSafeImagePath(path, store.id) ? path : null);
  const heroImagePaths: string[] = [];

  for (const [index, file] of heroImageFiles.entries()) {
    if (!file) {
      if (requestedHeroPaths[index]) heroImagePaths.push(requestedHeroPaths[index]);
      continue;
    }
    const extension = imageExtension(file.type);
    if (!extension) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "Formato de imagen de hero no soportado." }, { status: 400 });
    }
    if (file.size > 6 * 1024 * 1024) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "Cada imagen del hero no puede superar 6 MB." }, { status: 400 });
    }
    const path = `stores/${store.id}/branding/hero-${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "No se pudo subir una imagen del hero." }, { status: 500 });
    }
    uploadedHeroImages.push(path);
    heroImagePaths.push(path);
  }

  if (heroImageFiles.length < 3) {
    for (let index = heroImageFiles.length; index < requestedHeroPaths.length; index += 1) {
      const requestedPath = requestedHeroPaths[index];
      if (requestedPath) heroImagePaths.push(requestedPath);
    }
  }

  if (logoFile && logoFile.size > 0) {
    const extension = imageExtension(logoFile.type);
    if (!extension) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "Formato de logo no soportado." }, { status: 400 });
    }
    if (logoFile.size > 6 * 1024 * 1024) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "El logo no puede superar 6 MB." }, { status: 400 });
    }
    uploadedLogo = `stores/${store.id}/branding/${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(uploadedLogo, logoFile, { contentType: logoFile.type, upsert: false });
    if (error) {
      if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
      return NextResponse.json({ error: "No se pudo subir el logo." }, { status: 500 });
    }
    logoPath = uploadedLogo;
  }
  if (logoPath && !isSafeImagePath(logoPath, store.id)) logoPath = null;

  const nextSlug = slugify(result.data.name) || store.slug;
  const { data: updated, error } = await supabase.from("stores").update({
    name: result.data.name.trim(),
    slug: nextSlug,
    description: result.data.description?.trim() || null,
    whatsapp_phone: normalizeArgentineWhatsAppPhone(result.data.whatsappPhone),
    logo_path: logoPath,
    hero_title: result.data.heroTitle?.trim() || null,
    hero_subtitle: result.data.heroSubtitle?.trim() || null,
    hero_image_paths: heroImagePaths.slice(0, 3),
    address: result.data.address?.trim() || null,
    show_categories: result.data.showCategories,
    mobile_product_columns: result.data.mobileProductColumns,
    free_shipping_enabled: result.data.freeShippingEnabled,
    free_shipping_threshold: result.data.freeShippingThreshold,
    restrict_by_schedule: result.data.restrictBySchedule,
    business_hours: businessHours
  }).eq("id", store.id).select("*").single();

  if (error || !updated) {
    if (uploadedLogo) await supabase.storage.from(MEDIA_BUCKET).remove([uploadedLogo]);
    if (uploadedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploadedHeroImages);
    return NextResponse.json({ error: error?.code === "23505" ? "Ya existe esa URL pública." : "No se pudo guardar la configuración." }, { status: 500 });
  }
  if (store.logo_path && store.logo_path !== logoPath && isSafeImagePath(store.logo_path, store.id)) {
    await supabase.storage.from(MEDIA_BUCKET).remove([store.logo_path]);
  }
  const removedHeroImages = previousHeroImages.filter((path) => !heroImagePaths.includes(path));
  if (removedHeroImages.length) await supabase.storage.from(MEDIA_BUCKET).remove(removedHeroImages);
  return NextResponse.json({ store: { ...updated, logoUrl: updated.logo_path ? getPublicImageUrl(updated.logo_path) : null } });
}
