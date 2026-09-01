import Link from "next/link";
import { ArrowRight, ClipboardList, Package, Settings, ShoppingBag, Sparkles } from "lucide-react";

import { getAdminOrders } from "@/lib/admin-data";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { getMerchantContext } from "@/lib/merchant";
import { formatMoney } from "@/lib/money";
import { calculateOrderCost, isRevenueStatus } from "@/lib/order-financials";
import type { ProductRow } from "@/types/database";

const statusLabels: Record<string, string> = {
  PENDING_WHATSAPP: "Pendiente",
  PAID: "Pagado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado"
};

export default async function GestionDashboardPage() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return null;
  const [orders, { count: productCount }, { data: lowStock = [] }] = await Promise.all([
    getAdminOrders(supabase, store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id,name,stock_quantity").eq("store_id", store.id).not("stock_quantity", "is", null).lt("stock_quantity", 5).order("stock_quantity")
  ]);
  const lowStockProducts = lowStock ?? [];
  const revenueOrders = orders.filter((order) => isRevenueStatus(order.status));
  const earned = revenueOrders.reduce((sum, order) => sum + order.total, 0);
  const costs = revenueOrders.reduce((sum, order) => sum + calculateOrderCost(order.items), 0);
  const profit = earned - costs;

  return (
    <div className="space-y-6">
      <header className="panel sparkle-bg overflow-hidden bg-gradient-to-br from-[#fff0f6] to-[#f0e7fa] p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Panel de belleza</p>
        <h1 className="font-display mt-2 text-4xl font-black">Hola, {store.name}</h1>
        <p className="mt-2 text-muted">Todo lo importante de tu tienda, en un solo lugar.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="panel bg-white/85 p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Pedidos recibidos</p><ShoppingBag className="text-brand" size={20} /></div><p className="mt-3 text-3xl font-black">{orders.length}</p></article>
        <article className="panel bg-white/85 p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Facturación</p><Sparkles className="text-brand" size={20} /></div><p className="mt-3 text-3xl font-black">{formatMoney(earned)}</p></article>
        <article className="panel bg-white/85 p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Costo de compra</p><Package className="text-brand" size={20} /></div><p className="mt-3 text-3xl font-black">{formatMoney(costs)}</p></article>
        <article className="panel bg-white/85 p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Ganancia</p><Sparkles className="text-brand" size={20} /></div><p className="mt-3 text-3xl font-black text-emerald-700">{formatMoney(profit)}</p></article>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black">Atajos rápidos</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/gestion/pedidos", label: "Pedidos", description: "Revisá y actualizá estados", icon: ClipboardList },
            { href: "/gestion/productos", label: "Productos", description: `${productCount ?? 0} productos en catálogo`, icon: Package },
            { href: "/gestion/configuracion", label: "Mi marca", description: "Logo, colores y WhatsApp", icon: Settings }
          ].map((shortcut) => { const Icon = shortcut.icon; return <Link key={shortcut.href} href={shortcut.href} className="panel flex items-center gap-4 bg-white/85 p-5 transition hover:-translate-y-0.5 hover:border-brand"><span className="rounded-2xl bg-blush p-3 text-brand"><Icon size={22} /></span><span className="min-w-0 flex-1"><span className="block font-black">{shortcut.label}</span><span className="mt-1 block text-sm text-muted">{shortcut.description}</span></span><ArrowRight className="shrink-0 text-muted" size={18} /></Link>; })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel bg-white/85 p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">Últimos pedidos</h2><p className="mt-1 text-sm text-muted">Los cinco pedidos más recientes.</p></div><Link href="/gestion/pedidos" className="btn-secondary shrink-0">Ver todos <ArrowRight size={16} /></Link></div><div className="mt-5 divide-y divide-line">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div><p className="font-black">#{order.code} · {order.customerName}</p><p className="mt-1 text-sm text-muted">{formatBuenosAiresDate(order.createdAt)} · {statusLabels[order.status]}</p></div><p className="font-black">{formatMoney(order.total)}</p></div>)}{orders.length === 0 ? <div className="py-6 text-sm text-muted">Todavía no hay pedidos.</div> : null}</div></section>
        <section className="panel bg-white/85 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Bajo stock</h2><p className="mt-1 text-sm text-muted">Productos con menos de 5 unidades.</p></div><Package className={lowStockProducts.length ? "text-orange-500" : "text-brand"} size={22} /></div><div className="mt-5 divide-y divide-line">{(lowStockProducts as Array<Pick<ProductRow, "id" | "name" | "stock_quantity">>).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 py-3"><p className="truncate font-bold">{product.name}</p><span className="font-black text-orange-600">{product.stock_quantity} u.</span></div>)}{lowStockProducts.length === 0 ? <div className="py-6 text-sm text-muted">No hay productos con bajo stock.</div> : null}</div><Link href="/gestion/productos" className="mt-5 inline-flex items-center gap-2 font-bold text-brand">Revisar productos <ArrowRight size={16} /> </Link></section>
      </section>
    </div>
  );
}
