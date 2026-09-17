export const MAX_PRODUCT_UPLOAD_BYTES = 4 * 1024 * 1024;

const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const COMPRESSION_PROFILES = [
  { maxDimension: 2560, quality: 0.92 },
  { maxDimension: 2560, quality: 0.85 },
  { maxDimension: 2200, quality: 0.82 },
  { maxDimension: 1920, quality: 0.78 },
  { maxDimension: 1600, quality: 0.72 },
  { maxDimension: 1280, quality: 0.65 },
  { maxDimension: 960, quality: 0.55 }
] as const;

function webpName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "") || "producto";
  return `${baseName}.webp`;
}

function totalSize(files: File[]) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

async function renderAsWebp(file: File, maxDimension: number, quality: number) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen.");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

export async function optimizeProductImages(files: File[]) {
  if (!files.length) return files;

  const fixedFiles = files.filter((file) => !COMPRESSIBLE_IMAGE_TYPES.has(file.type));
  if (totalSize(fixedFiles) > MAX_PRODUCT_UPLOAD_BYTES) {
    throw new Error("Los archivos GIF superan el tamaño permitido. Quitá uno o elegí archivos más livianos.");
  }

  for (const profile of COMPRESSION_PROFILES) {
    const optimized: File[] = [];
    for (const file of files) {
      if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
        optimized.push(file);
        continue;
      }
      const compressed = await renderAsWebp(file, profile.maxDimension, profile.quality);
      optimized.push(compressed.size < file.size ? compressed : file);
    }
    if (totalSize(optimized) <= MAX_PRODUCT_UPLOAD_BYTES) return optimized;
  }

  throw new Error("No se pudieron reducir todas las imágenes al tamaño permitido. Quitá una imagen o elegí archivos más livianos.");
}
