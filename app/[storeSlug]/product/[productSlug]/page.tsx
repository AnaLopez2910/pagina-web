import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getPublicProduct, getPublicStore } from "@/lib/catalog-data";
import { getEffectiveProductPrice } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

type Params = Promise<{ storeSlug: string; productSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const [catalog, product] = await Promise.all([getPublicStore(storeSlug), getPublicProduct(storeSlug, productSlug)]);
  if (!catalog || !product) return {};
  return { title: `${product.name} · ${catalog.store.name}`, description: product.description ?? `Producto de ${catalog.store.name}`, openGraph: { images: product.imageUrls.slice(0, 1) } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { storeSlug, productSlug } = await params;
  const [catalog, product] = await Promise.all([getPublicStore(storeSlug), getPublicProduct(storeSlug, productSlug)]);
  if (!catalog || !product) notFound();
  const price = getEffectiveProductPrice(product);
  return <main className="container-page min-h-screen py-8"><Link href="/" className="font-display text-2xl font-black text-brand">{catalog.store.name}</Link><div className="mt-8 grid gap-8 md:grid-cols-2"><div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-blush to-lilac p-3">{product.imageUrls[0] ? <div className="relative aspect-square"><Image src={product.imageUrls[0]} alt={product.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="rounded-[26px] object-cover" /> </div> : <div className="grid aspect-square place-items-center rounded-[26px] text-brand">Sin imagen</div>}</div><section className="self-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{product.category?.name ?? "Belleza"}</p><h1 className="font-display mt-3 text-5xl font-black">{product.name}</h1><p className="mt-4 leading-7 text-muted">{product.description}</p><p className="mt-6 text-3xl font-black text-brand">{formatMoney(price)}</p><Link href="/" className="btn-primary mt-8">Elegir opciones y pedir</Link></section></div></main>;
}
