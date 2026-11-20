import { NextResponse } from "next/server";
import { z } from "zod";

import { getMerchantContext } from "@/lib/merchant";
import { PRODUCT_SORTS } from "@/lib/product-order";

const settingsSchema = z.object({
  productSort: z.enum(PRODUCT_SORTS),
  soldOutLast: z.boolean()
});

const manualOrderSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(5000)
});

const MISSING_MIGRATION_ERROR = "Falta actualizar la base de datos para guardar el orden. Aplicá la migración de orden de productos en Supabase.";

// Store-wide order setting (Productos > Orden).
export async function PATCH(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Elegí un orden válido." }, { status: 400 });

  const { error } = await supabase
    .from("stores")
    .update({ product_sort: result.data.productSort, sold_out_last: result.data.soldOutLast })
    .eq("id", store.id);
  if (error) {
    const missingColumn = error.code === "PGRST204" || error.code === "42703";
    return NextResponse.json({ error: missingColumn ? MISSING_MIGRATION_ERROR : "No se pudo guardar el orden." }, { status: 500 });
  }
  return NextResponse.json({ productSort: result.data.productSort, soldOutLast: result.data.soldOutLast });
}

// Manual order: the full list of the store's products, first to last.
export async function PUT(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Orden inválido." }, { status: 400 });

  const productIds = result.data.productIds;
  if (new Set(productIds).size !== productIds.length) {
    return NextResponse.json({ error: "El orden contiene productos repetidos." }, { status: 400 });
  }

  const { data: storeProducts, error: lookupError } = await supabase.from("products").select("id").eq("store_id", store.id);
  if (lookupError) return NextResponse.json({ error: "No se pudieron validar los productos." }, { status: 500 });
  const storeProductIds = new Set((storeProducts ?? []).map((product) => product.id));
  if (storeProductIds.size !== productIds.length || productIds.some((id) => !storeProductIds.has(id))) {
    return NextResponse.json({ error: "La lista cambió mientras ordenabas. Recargá la página e intentá de nuevo." }, { status: 409 });
  }

  const { error } = await supabase.rpc("reorder_products", { p_product_ids: productIds });
  if (error) {
    const missingFunction = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json({ error: missingFunction ? MISSING_MIGRATION_ERROR : "No se pudo guardar el orden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
