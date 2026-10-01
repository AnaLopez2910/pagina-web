import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProducts } from "@/lib/admin-data";
import { resolveProductCategoryId } from "@/lib/admin-catalog";
import { getMerchantContext } from "@/lib/merchant";

const bulkUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("visibility"),
    productIds: z.array(z.string().min(1).max(80)).min(1).max(1000),
    isVisible: z.boolean()
  }),
  z.object({
    action: z.literal("category"),
    productIds: z.array(z.string().min(1).max(80)).min(1).max(1000),
    categoryId: z.string().nullable(),
    categoryName: z.string().trim().min(2).max(80).optional()
  })
]).superRefine((value, context) => {
  if (value.action === "category" && value.categoryId === "__new" && !value.categoryName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryName"], message: "Ingresá el nombre de la nueva categoría." });
  }
});

export async function PATCH(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = bulkUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const productIds = Array.from(new Set(result.data.productIds));
  if (productIds.length !== result.data.productIds.length) {
    return NextResponse.json({ error: "La selección contiene productos repetidos." }, { status: 400 });
  }

  const { data: existingProducts, error: lookupError } = await supabase
    .from("products")
    .select("id")
    .eq("store_id", store.id)
    .in("id", productIds);
  if (lookupError) return NextResponse.json({ error: "No se pudieron validar los productos." }, { status: 500 });
  if (!existingProducts || existingProducts.length !== productIds.length) {
    return NextResponse.json({ error: "Uno o más productos ya no están disponibles." }, { status: 404 });
  }

  let updates: { is_visible?: boolean; category_id?: string | null };
  if (result.data.action === "visibility") {
    updates = { is_visible: result.data.isVisible };
  } else {
    try {
      updates = {
        category_id: await resolveProductCategoryId(supabase, store.id, result.data.categoryId, result.data.categoryName)
      };
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Datos inválidos" }, { status: 400 });
    }
  }

  const { error: updateError } = await supabase
    .from("products")
    .update(updates)
    .eq("store_id", store.id)
    .in("id", productIds);
  if (updateError) return NextResponse.json({ error: "No se pudieron actualizar los productos." }, { status: 500 });

  const updatedProducts = await getAdminProducts(supabase, store.id);
  return NextResponse.json({ products: updatedProducts.filter((product) => productIds.includes(product.id)) });
}
