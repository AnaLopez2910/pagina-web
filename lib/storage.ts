export const MEDIA_BUCKET = "catalog-media";

export function getPublicImageUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export function isSafeImagePath(path: string, storeId: string) {
  return path.startsWith(`stores/${storeId}/`) && !path.includes("..") && !path.includes("\\");
}

export function imageExtension(contentType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return extensions[contentType] ?? null;
}
