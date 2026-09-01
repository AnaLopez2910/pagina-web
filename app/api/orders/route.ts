import { NextResponse } from "next/server";
import { z } from "zod";

import { getStoreAvailability, isCompleteArgentineLocalPhone, isValidCustomerName } from "@/lib/store-settings";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppOrderUrl } from "@/lib/whatsapp";
import type { Json } from "@/types/database";

const orderSchema = z.object({
  storeSlug: z.string().trim().min(2).max(90),
  customerName: z.string().trim().max(100).refine(isValidCustomerName, "El nombre debe tener al menos 3 caracteres y solo letras."),
  customerPhone: z.string().trim().refine(isCompleteArgentineLocalPhone, "El teléfono debe tener 10 dígitos."),
  fulfillment: z.string().trim().min(2).max(80),
  address: z.string().trim().max(180).optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(99),
    selectedOptionIds: z.array(z.string().uuid()).max(30).default([])
  })).min(1).max(80)
}).superRefine((value, context) => {
  if (value.fulfillment === "Envío" && !value.address) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["address"], message: "La dirección de entrega es obligatoria." });
  }
});

type OrderSnapshot = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  options: Array<{ groupName: string; optionName: string; priceDelta: number }>;
};

function isOrderSnapshot(value: unknown): value is OrderSnapshot[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return typeof record.productName === "string" && typeof record.quantity === "number" && typeof record.unitPrice === "number" && typeof record.subtotal === "number" && Array.isArray(record.options);
  });
}

export async function POST(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("name,whatsapp_phone,business_hours,restrict_by_schedule").eq("slug", parsed.data.storeSlug).eq("is_published", true).maybeSingle();
  if (!store) return NextResponse.json({ error: "Tienda no disponible" }, { status: 404 });

  const availability = getStoreAvailability({ restrictBySchedule: store.restrict_by_schedule, businessHours: store.business_hours });
  if (!availability.isOpen) return NextResponse.json({ error: availability.label }, { status: 409 });

  const { data, error } = await supabase.rpc("create_public_order", {
    p_store_slug: parsed.data.storeSlug,
    p_customer_name: parsed.data.customerName,
    p_customer_phone: parsed.data.customerPhone,
    p_fulfillment: parsed.data.fulfillment,
    p_notes: parsed.data.address ? `Dirección de entrega: ${parsed.data.address}` : null,
    p_items: parsed.data.items as unknown as Json
  });

  if (error || !data?.[0]) {
    console.error("create_public_order failed", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      returnedData: Boolean(data?.[0])
    });
    return NextResponse.json({ error: "No se pudo crear el pedido. Revisá los productos e intentá nuevamente." }, { status: 409 });
  }

  const result = data[0];
  const items = isOrderSnapshot(result.items) ? result.items : [];
  const whatsappUrl = buildWhatsAppOrderUrl({
    phone: result.whatsapp_phone || store.whatsapp_phone,
    storeName: result.store_name || store.name,
    code: result.code,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    fulfillment: parsed.data.fulfillment,
    address: parsed.data.address,
    items,
    total: result.total
  });

  return NextResponse.json({ orderId: result.order_id, code: result.code, whatsappUrl });
}
