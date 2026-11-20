import { renderProductShareImage } from "@/lib/product-share-image";
import { shareImageSize } from "@/lib/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Foto y precio del producto";
export const size = shareImageSize;
export const contentType = "image/jpeg";

export default async function ProductOpenGraphImage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  return renderProductShareImage(productSlug.toLowerCase());
}
