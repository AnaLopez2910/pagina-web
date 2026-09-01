import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminCategories } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import { imageExtension, isSafeImagePath, MEDIA_BUCKET } from "@/lib/storage";
import { slugify } from "@/lib/slug";

type Params = Promise<{ categoryId: string }>;
const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  imagePath: z.string().optional().nullable()
});

async function parseRequest(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), imageFile: null as File | null };
  }
  const formData = await request.formData();
  const imageFile = formData.get("imageFile");
  return {
    body: {
      name: typeof formData.get("name") === "string" ? formData.get("name") : undefined,
      imagePath: typeof formData.get("imagePath") === "string" ? formData.get("imagePath") : null
    },
    imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : null
  };
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { categoryId } = await params;
  const { data: category } = await supabase.from("categories").select("id,name,slug,image_path").eq("id", categoryId).eq("store_id", store.id).maybeSingle();
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  const { body, imageFile } = await parseRequest(request).catch(() => ({ body: null, imageFile: null }));
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const name = result.data.name?.trim() || category.name;
  const slug = result.data.name ? slugify(name) : category.slug;
  if (!slug) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  if (result.data.name) {
    const { data: collision } = await supabase.from("categories").select("id").eq("store_id", store.id).eq("slug", slug).neq("id", categoryId).maybeSingle();
    if (collision) return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  let imagePath = category.image_path;
  let uploadedImage: string | null = null;
  if (imageFile) {
    const extension = imageExtension(imageFile.type);
    if (!extension) return NextResponse.json({ error: "Formato de imagen no soportado." }, { status: 400 });
    if (imageFile.size > 6 * 1024 * 1024) return NextResponse.json({ error: "La imagen no puede superar 6 MB." }, { status: 400 });
    uploadedImage = `stores/${store.id}/categories/${categoryId}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(uploadedImage, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
    imagePath = uploadedImage;
  } else if (result.data.imagePath !== undefined) {
    imagePath = result.data.imagePath && isSafeImagePath(result.data.imagePath, store.id) ? result.data.imagePath : null;
  }

  const { error } = await supabase.from("categories").update({ name, slug, image_path: imagePath }).eq("id", categoryId).eq("store_id", store.id);
  if (error) {
    if (uploadedImage) await supabase.storage.from(MEDIA_BUCKET).remove([uploadedImage]);
    return NextResponse.json({ error: "No se pudo actualizar la categoría" }, { status: 500 });
  }
  if (category.image_path && category.image_path !== imagePath && isSafeImagePath(category.image_path, store.id)) {
    await supabase.storage.from(MEDIA_BUCKET).remove([category.image_path]);
  }
  return NextResponse.json({ categories: await getAdminCategories(supabase, store.id) });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { categoryId } = await params;
  const { error } = await supabase.from("categories").delete().eq("id", categoryId).eq("store_id", store.id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar la categoría" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
