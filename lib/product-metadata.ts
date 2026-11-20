import type { Metadata } from "next";

import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import type { PublicStore, StorefrontProduct } from "@/lib/catalog-data";
import { formatMoney } from "@/lib/money";

// Title and description for search results and for the card WhatsApp shows under a shared link.
export function buildProductMetadata(store: PublicStore, product: StorefrontProduct, url: string): Metadata {
  const title = `${product.name} | ${store.name}`;
  const price = getEffectiveProductPrice(product);
  const discount = getDiscountPercent(product);
  const lead = `${formatMoney(price)}${discount ? ` (-${discount}%)` : ""}`;
  const summary = product.description?.replace(/\s+/g, " ").trim();
  const text = summary ? `${lead} · ${summary}` : `${lead} · ${product.category?.name ?? "Belleza"} en ${store.name}. Pedilo por WhatsApp.`;
  const description = text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "es_AR", siteName: store.name, title, description, url },
    twitter: { card: "summary_large_image", title, description },
    other: { "product:price:amount": String(price), "product:price:currency": "ARS" }
  };
}

export function buildProductJsonLd(store: PublicStore, product: StorefrontProduct, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrls.length ? product.imageUrls : undefined,
    category: product.category?.name,
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "ARS",
      price: getEffectiveProductPrice(product),
      availability: product.stockQuantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: store.name }
    }
  };
}

export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
