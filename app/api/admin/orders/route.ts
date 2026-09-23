import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAdminOrderItem } from "@/lib/admin-orders";
import { getAdminOrders } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";

const schema = z.object({
  status: z.enum(["PENDING_WHATSAPP", "PAID", "DELIVERED", "CANCELLED"]).default("PENDING_WHATSAPP"),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(6).max(40),
  fulfillment: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(500).optional().default(""),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    selectedOptionIds: z.array(z.string().uuid()).max(30).default([])
  })).min(1).max(80)
});

export async function POST(request: Request) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Revisá los datos del pedido." }, { status: 400 });

  let resolvedItems: Array<Awaited<ReturnType<typeof buildAdminOrderItem>>>;
  try {
    resolvedItems = [];
    for (const item of result.data.items) {
      resolvedItems.push(await buildAdminOrderItem(supabase, store.id, item.productId, item.quantity, item.selectedOptionIds));
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron validar los productos." }, { status: 400 });
  }

  const notes = result.data.notes.trim() || null;
  const total = resolvedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const code = `PED-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: createdOrder, error: createError } = await supabase.from("orders").insert({
    store_id: store.id,
    code,
    status: result.data.status,
    customer_name: result.data.customerName,
    customer_phone: result.data.customerPhone,
    fulfillment: result.data.fulfillment,
    notes,
    total,
    checkout: {
      customerName: result.data.customerName,
      customerPhone: result.data.customerPhone,
      fulfillment: result.data.fulfillment,
      notes
    }
  }).select("id").single();

  if (createError || !createdOrder) {
    return NextResponse.json({ error: "No se pudo crear el pedido." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    resolvedItems.map((item) => ({ order_id: createdOrder.id, ...item }))
  );
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", createdOrder.id).eq("store_id", store.id);
    return NextResponse.json({ error: "No se pudieron guardar los productos del pedido." }, { status: 500 });
  }

  const order = (await getAdminOrders(supabase, store.id)).find((item) => item.id === createdOrder.id);
  if (!order) return NextResponse.json({ error: "El pedido se creó, pero no se pudo cargar." }, { status: 500 });
  return NextResponse.json({ order }, { status: 201 });
}
