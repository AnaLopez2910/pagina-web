import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin-nav";
import { getCurrentUserId, getMerchantStore } from "@/lib/merchant";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";

export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const store = await getMerchantStore();
  if (!store) {
    redirect("/login");
  }

  return (
    <UnsavedChangesProvider>
      <main className="gestion-shell container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr]">
        <AdminNav storeSlug={store.slug} />
        <section>{children}</section>
      </main>
    </UnsavedChangesProvider>
  );
}
