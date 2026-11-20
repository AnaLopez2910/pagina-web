import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { getPublicProduct } from "@/lib/catalog-data";
import { buildProductJsonLd, buildProductMetadata, jsonLdScript } from "@/lib/product-metadata";
import { productPath } from "@/lib/product-url";

export const dynamic = "force-dynamic";

type Params = Promise<{ productSlug: string }>;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { productSlug } = await params;
  const result = await getPublicProduct(productSlug.toLowerCase());
  if (!result) return { title: "Producto no encontrado" };
  return buildProductMetadata(result.catalog.store, result.product, `${siteUrl}${productPath(result.product.slug)}`);
}

export default async function ProductPage({ params }: { params: Params }) {
  const { productSlug } = await params;
  const result = await getPublicProduct(productSlug.toLowerCase());
  if (!result) notFound();
  const { catalog, product } = result;
  // A renamed product, or a link from before codes existed, lands on the current address.
  if (product.slug !== productSlug) permanentRedirect(productPath(product.slug));
  const url = `${siteUrl}${productPath(product.slug)}`;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(buildProductJsonLd(catalog.store, product, url))} />
      <PublicStore key={product.id} store={{ ...catalog.store, availability: catalog.availability }} products={catalog.products} product={product} productUrl={url} />
    </>
  );
}
