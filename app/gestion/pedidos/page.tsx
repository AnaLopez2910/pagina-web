import { OrderManager } from "@/components/order-manager";
import { getAdminOrders, getAdminProducts } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";

export default async function GestionOrdersPage() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return null;
  const [orders, products] = await Promise.all([
    getAdminOrders(supabase, store.id),
    getAdminProducts(supabase, store.id)
  ]);
  return (
    <div className="space-y-6">
      <header className="panel sparkle-bg bg-gradient-to-br from-[#fff0f6] to-[#f0e7fa] p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pedidos</p>
        <h1 className="font-display mt-2 text-4xl font-black">Pedidos de {store.name}</h1>
        <p className="mt-2 text-muted">Los pedidos se guardan antes de abrir WhatsApp.</p>
      </header>
      <OrderManager orders={orders} products={products} />
    </div>
  );
}
