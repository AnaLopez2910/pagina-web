/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import { getPublicProduct, type PublicStore, type StorefrontProduct } from "@/lib/catalog-data";
import { formatMoney } from "@/lib/money";
import { renderShareImage, shareImageSize } from "@/lib/share-image";

// The preview WhatsApp, Instagram and Facebook show when a product link is shared.
// It goes out as a JPEG: a photo saved as PNG is too heavy and WhatsApp skips previews over ~300 KB.

const PHOTO_SIZE = 550;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

type Font = { name: string; data: ArrayBuffer; weight: 600 | 800; style: "normal" };

// Satori can't read WebP, which is how product photos are stored, so the photo is handed over as a JPEG.
async function imageDataUrl(url: string | null | undefined, width: number, height: number, fit: "cover" | "contain") {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SOURCE_BYTES) return null;
    const jpeg = await sharp(bytes).rotate().resize(width, height, { fit, background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

// Only the glyphs on the card are downloaded; without the fonts the card falls back to the default one.
async function loadGoogleFont(family: string, weight: Font["weight"], text: string): Promise<Font | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const source = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!source) return null;
    const response = await fetch(source);
    return response.ok ? { name: family, data: await response.arrayBuffer(), weight, style: "normal" } : null;
  } catch {
    return null;
  }
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
}

export async function renderProductShareImage(productSlug: string) {
  const result = await getPublicProduct(productSlug).catch(() => null);
  return result ? drawProductShareImage(result.catalog.store, result.product) : renderShareImage();
}

export async function drawProductShareImage(store: PublicStore, product: StorefrontProduct) {

  const name = truncate(product.name, 70);
  const storeName = truncate(store.name, 40);
  const category = (product.category?.name ?? "Belleza").toLocaleUpperCase("es-AR");
  const price = formatMoney(getEffectiveProductPrice(product));
  const discount = getDiscountPercent(product);
  const oldPrice = discount ? formatMoney(product.basePrice) : null;
  const nameSize = name.length > 44 ? 52 : name.length > 24 ? 62 : 72;

  const [photo, logo, displayFont, textFont] = await Promise.all([
    imageDataUrl(product.imageUrls[0], PHOTO_SIZE, PHOTO_SIZE, "cover"),
    imageDataUrl(store.logoUrl, 128, 128, "cover"),
    loadGoogleFont("Fredoka", 600, name),
    loadGoogleFont("Nunito", 800, `${storeName}${category}${price}${oldPrice ?? ""}-${discount ?? ""}%Pedilo por WhatsApp`)
  ]);
  const fonts = [displayFont, textFont].filter((font): font is Font => Boolean(font));

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 52, position: "relative", overflow: "hidden", padding: 40, background: "#fff6f8", color: "#4a2836", fontFamily: textFont ? "Nunito" : undefined }}>
        <div style={{ position: "absolute", width: 520, height: 520, right: -170, top: -230, borderRadius: 260, background: "#ffe1ea", display: "flex" }} />
        <div style={{ position: "absolute", width: 300, height: 300, right: 120, bottom: -210, borderRadius: 150, background: "#f3e6f6", display: "flex" }} />

        <div style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", borderRadius: 44, background: "#ffeef3", boxShadow: "0 20px 50px rgba(207, 63, 116, 0.18)" }}>
          {photo ? <img src={photo} alt="" width={PHOTO_SIZE} height={PHOTO_SIZE} style={{ objectFit: "cover" }} /> : <div style={{ color: "#cf3f74", fontSize: 120, display: "flex" }}>♥</div>}
          {discount ? <div style={{ position: "absolute", top: 26, left: 26, display: "flex", padding: "8px 20px", borderRadius: 999, background: "#cf3f74", color: "#ffffff", fontSize: 30, fontWeight: 800 }}>-{discount}%</div> : null}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo
              ? <img src={logo} alt="" width={64} height={64} style={{ borderRadius: 32, border: "3px solid #ffffff" }} />
              : <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 32, background: "#cf3f74", color: "#ffffff", fontSize: 32, fontWeight: 800 }}>{storeName.slice(0, 1).toUpperCase()}</div>}
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{storeName}</div>
          </div>
          <div style={{ display: "flex", marginTop: 44, color: "#cf3f74", fontSize: 24, fontWeight: 800, letterSpacing: 4 }}>{category}</div>
          <div style={{ display: "flex", marginTop: 12, fontFamily: displayFont ? "Fredoka" : undefined, fontSize: nameSize, fontWeight: 600, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
            <div style={{ display: "flex", padding: "10px 28px", borderRadius: 999, background: "#cf3f74", color: "#ffffff", fontSize: 44, fontWeight: 800 }}>{price}</div>
            {oldPrice ? <div style={{ display: "flex", color: "#85606e", fontSize: 30, textDecoration: "line-through" }}>{oldPrice}</div> : null}
          </div>
          <div style={{ display: "flex", marginTop: 34, color: "#85606e", fontSize: 26, fontWeight: 800 }}>Pedilo por WhatsApp</div>
        </div>
      </div>
    ),
    { ...shareImageSize, fonts }
  );

  const jpeg = await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" }
  });
}
