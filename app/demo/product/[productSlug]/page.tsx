import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { demoProducts, demoStore } from "@/lib/demo-catalog";
import { buildProductMetadata } from "@/lib/product-metadata";
import { findProductBySlug, productPath } from "@/lib/product-url";

type Params = Promise<{ productSlug: string }>;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { productSlug } = await params;
  const product = findProductBySlug(demoProducts, productSlug);
  if (!product) return {};
  return { ...buildProductMetadata(demoStore, product, `${siteUrl}${productPath(product.slug, "/demo")}`), robots: { index: false, follow: false } };
}

// Local preview of the product page with the sample catalog.
export default async function DemoProductPage({ params }: { params: Params }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { productSlug } = await params;
  const product = findProductBySlug(demoProducts, productSlug);
  if (!product) notFound();
  if (product.slug !== productSlug) redirect(productPath(product.slug, "/demo"));
  return <PublicStore key={product.id} store={demoStore} products={demoProducts} product={product} productUrl={`${siteUrl}${productPath(product.slug, "/demo")}`} basePath="/demo" preview />;
}
