import { CategoryManager } from "@/components/category-manager";
import { getAdminCategories } from "@/lib/admin-data";
import { getMerchantContext } from "@/lib/merchant";

export default async function GestionCategoriesPage() {
  const { supabase, store } = await getMerchantContext();
  if (!store) return null;
  const categories = await getAdminCategories(supabase, store.id);
  return (
    <div className="space-y-6">
      <header className="panel sparkle-bg bg-gradient-to-br from-[#fff0f6] to-[#f0e7fa] p-5 sm:p-6 md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Catálogo</p>
        <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">Categorías</h1>
        <p className="mt-2 text-muted">Creá, renombrá y poneles foto a tus categorías.</p>
      </header>
      <CategoryManager categories={categories} />
    </div>
  );
}
