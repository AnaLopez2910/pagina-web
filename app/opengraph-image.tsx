import { renderShareImage, shareImageSize } from "@/lib/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Oli Shop | Catálogo de belleza";
export const size = shareImageSize;
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return renderShareImage();
}
