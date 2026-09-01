import { ProductForm } from "@/components/product-form";
import { getAdminCategories, getAdminProducts } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";

export default async function GestionProductsPage() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return null;
  const [products, categories] = await Promise.all([
    getAdminProducts(supabase, store.id),
    getAdminCategories(supabase, store.id)
  ]);
  return (
    <div className="space-y-6">
      <header className="panel sparkle-bg bg-gradient-to-br from-[#fff0f6] to-[#f0e7fa] p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Catálogo</p>
        <h1 className="font-display mt-2 text-4xl font-black">Productos y opciones</h1>
        <p className="mt-2 text-muted">Gestioná pestañas, maquillaje, tonos, variantes, imágenes y stock.</p>
      </header>
      <ProductForm products={products} categories={categories} />
    </div>
  );
}
