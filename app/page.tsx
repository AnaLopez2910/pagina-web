import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicStore } from "@/components/public-store";
import { getPublicStore } from "@/lib/catalog-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getPublicStore();
  if (!catalog) return { title: "Tienda no disponible" };
  const title = `${catalog.store.name} | Catálogo`;
  const description = catalog.store.description ?? catalog.store.heroSubtitle ?? "Belleza que brilla.";
  const image = catalog.store.heroImageUrls[0] ?? catalog.store.logoUrl ?? undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    title,
    description,
    alternates: { canonical: siteUrl },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: catalog.store.name,
      title,
      description,
      url: siteUrl,
      ...(image ? { images: [{ url: image, alt: `Imagen de ${catalog.store.name}` }] } : {})
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {})
    }
  };
}

export default async function HomePage() {
  const catalog = await getPublicStore();
  if (!catalog) notFound();
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: catalog.store.name,
    description: catalog.store.description ?? catalog.store.heroSubtitle ?? undefined,
    telephone: catalog.store.whatsappPhone ? `+${catalog.store.whatsappPhone.replace(/\D/g, "")}` : undefined,
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ...(catalog.store.address ? { address: { "@type": "PostalAddress", streetAddress: catalog.store.address } } : {}),
    ...(catalog.store.logoUrl ? { image: catalog.store.logoUrl, logo: catalog.store.logoUrl } : {})
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd).replace(/</g, "\\u003c") }} />
      <PublicStore store={{ ...catalog.store, availability: catalog.availability }} products={catalog.products} />
    </>
  );
}
