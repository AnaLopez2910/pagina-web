import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAdminOrderItem } from "@/lib/admin-orders";
import { getAdminOrders } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";
import type { Json } from "@/types/database";

type Params = Promise<{ orderId: string }>;
const schema = z.object({
  status: z.enum(["PENDING_WHATSAPP", "PAID", "DELIVERED", "CANCELLED"]).optional(),
  customerName: z.string().trim().min(2).max(100).optional(),
  customerPhone: z.string().trim().min(6).max(40).optional(),
  fulfillment: z.string().trim().min(2).max(80).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({
    id: z.string().uuid().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(99),
    selectedOptionIds: z.array(z.string().uuid()).optional()
  })).min(1).max(80).optional()
}).refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar.");

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { orderId } = await params;
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { data: currentItemsData, error: currentItemsError } = result.data.items
    ? await supabase.from("order_items").select("*").eq("order_id", orderId)
    : { data: null, error: null };
  if (currentItemsError) return NextResponse.json({ error: "No se pudieron leer los productos del pedido." }, { status: 500 });
  const currentItems = currentItemsData ?? [];

  let resolvedItems: Array<{
    id: string | null;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    purchase_price: number;
    options: Json;
    subtotal: number;
  }> | null = null;
  if (result.data.items) {
    const currentItemsById = new Map(currentItems.map((item) => [item.id, item]));
    try {
      resolvedItems = [];
      for (const item of result.data.items) {
        const currentItem = item.id ? currentItemsById.get(item.id) : undefined;
        if (item.id && !currentItem) throw new Error("Hay un producto del pedido que ya no existe.");
        const productId = item.productId ?? currentItem?.product_id ?? null;
        const canKeepSnapshot = Boolean(currentItem) && productId === currentItem?.product_id && item.selectedOptionIds === undefined;
        if (canKeepSnapshot && currentItem) {
          resolvedItems.push({
            id: currentItem.id,
            product_id: currentItem.product_id,
            product_name: currentItem.product_name,
            quantity: item.quantity,
            unit_price: currentItem.unit_price,
            purchase_price: currentItem.purchase_price,
            options: currentItem.options,
            subtotal: currentItem.unit_price * item.quantity
          });
          continue;
        }
        if (!productId) throw new Error("Cada línea nueva debe tener un producto.");
        const rebuilt = await buildAdminOrderItem(supabase, store.id, productId, item.quantity, item.selectedOptionIds ?? []);
        resolvedItems.push({ id: currentItem?.id ?? null, ...rebuilt });
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron actualizar los productos." }, { status: 400 });
    }
  }
  const update = {
    ...(result.data.status === undefined ? {} : { status: result.data.status }),
    ...(result.data.customerName === undefined ? {} : { customer_name: result.data.customerName }),
    ...(result.data.customerPhone === undefined ? {} : { customer_phone: result.data.customerPhone }),
    ...(result.data.fulfillment === undefined ? {} : { fulfillment: result.data.fulfillment }),
    ...(result.data.notes === undefined ? {} : { notes: result.data.notes || null }),
    ...(resolvedItems ? { total: resolvedItems.reduce((sum, item) => sum + item.subtotal, 0) } : {})
  };
  if (resolvedItems) {
    const submittedItemIds = new Set(resolvedItems.flatMap((item) => item.id ? [item.id] : []));
    for (const item of resolvedItems) {
      const values = {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        purchase_price: item.purchase_price,
        options: item.options,
        subtotal: item.subtotal
      };
      const itemResult = item.id
        ? await supabase.from("order_items").update(values).eq("id", item.id).eq("order_id", orderId)
        : await supabase.from("order_items").insert({ order_id: orderId, ...values });
      if (itemResult.error) return NextResponse.json({ error: "No se pudieron actualizar los productos del pedido." }, { status: 500 });
    }
    const removedItemIds = currentItems.filter((item) => !submittedItemIds.has(item.id)).map((item) => item.id);
    if (removedItemIds.length) {
      const { error: removeItemsError } = await supabase.from("order_items").delete().in("id", removedItemIds).eq("order_id", orderId);
      if (removeItemsError) return NextResponse.json({ error: "No se pudieron eliminar los productos quitados." }, { status: 500 });
    }
  }
  const { data: order, error } = await supabase.from("orders").update(update).eq("id", orderId).eq("store_id", store.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo actualizar el pedido." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  const updatedOrder = (await getAdminOrders(supabase, store.id)).find((item) => item.id === orderId);
  if (!updatedOrder) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  return NextResponse.json({ order: updatedOrder });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { supabase, store } = await getMerchantContext();
  if (!store) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { orderId } = await params;
  const { data: order, error } = await supabase.from("orders").delete().eq("id", orderId).eq("store_id", store.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo eliminar el pedido." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
