import { demoProducts, demoStore } from "@/lib/demo-catalog";
import { drawProductShareImage } from "@/lib/product-share-image";
import { shareImageSize } from "@/lib/share-image";
import { findProductBySlug } from "@/lib/product-url";

export const runtime = "nodejs";
export const alt = "Foto y precio del producto";
export const size = shareImageSize;
export const contentType = "image/jpeg";

export default async function DemoProductOpenGraphImage({ params }: { params: Promise<{ productSlug: string }> }) {
  const product = findProductBySlug(demoProducts, (await params).productSlug);
  if (process.env.NODE_ENV === "production" || !product) return new Response(null, { status: 404 });
  return drawProductShareImage(demoStore, product);
}
