import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminCategories } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import { slugify } from "@/lib/slug";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function GET() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ categories: await getAdminCategories(supabase, store.id) });
}

export async function POST(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const name = result.data.name.trim();
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  const { data: existing } = await supabase.from("categories").select("id").eq("store_id", store.id).eq("slug", slug).maybeSingle();
  if (existing) return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  const { error } = await supabase.from("categories").insert({ store_id: store.id, name, slug });
  if (error) return NextResponse.json({ error: "No se pudo crear la categoría" }, { status: 500 });
  return NextResponse.json({ categories: await getAdminCategories(supabase, store.id) });
}
