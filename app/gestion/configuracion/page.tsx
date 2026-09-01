import { StoreSettingsForm } from "@/components/store-settings-form";
import { getAdminCategories } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";

export default async function GestionSettingsPage() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return null;
  const categories = await getAdminCategories(supabase, store.id);
  return (
    <div className="space-y-6">
      <header className="panel sparkle-bg bg-gradient-to-br from-[#fff0f6] to-[#f0e7fa] p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Mi marca</p>
        <h1 className="font-display mt-2 text-4xl font-black">Configuración de la tienda</h1>
        <p className="mt-2 text-muted">Logo, contenido, categorías y datos para recibir pedidos.</p>
      </header>
      <StoreSettingsForm store={store} initialCategories={categories} />
    </div>
  );
}
