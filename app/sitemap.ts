import type { MetadataRoute } from "next";

import { getPublicStore } from "@/lib/catalog-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const catalog = await getPublicStore();
    if (!catalog) return [{ url: baseUrl, lastModified: new Date() }];
    return [
      { url: baseUrl, lastModified: new Date() },
      ...catalog.products.map((product) => ({ url: `${baseUrl}/${catalog.store.slug}/product/${product.slug}`, lastModified: new Date() }))
    ];
  } catch {
    return [{ url: baseUrl, lastModified: new Date() }];
  }
}
