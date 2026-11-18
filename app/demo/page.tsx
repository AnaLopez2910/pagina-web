import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { demoProducts, demoStore } from "@/lib/demo-catalog";

export const metadata: Metadata = {
  title: "Demo de la tienda",
  robots: { index: false, follow: false }
};

// Local preview with sample products, for working on the storefront without a Supabase project.
export default function StorefrontDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PublicStore store={demoStore} products={demoProducts} preview />;
}
