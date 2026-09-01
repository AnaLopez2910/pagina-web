/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";

import { getPublicStoreBranding } from "@/lib/catalog-data";

export const shareImageSize = { width: 1200, height: 630 } as const;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function getLogoDataUrl(url: string | null) {
  if (!url) return null;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";", 1)[0] ?? "image/png";
    const contentLength = Number(response.headers.get("content-length"));
    if (!contentType.startsWith("image/") || (contentLength && contentLength > MAX_LOGO_BYTES)) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_LOGO_BYTES) return null;

    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderShareImage() {
  let branding: Awaited<ReturnType<typeof getPublicStoreBranding>> = null;

  try {
    branding = await getPublicStoreBranding();
  } catch {
    // The card still renders with a useful fallback when the catalog is unavailable.
  }

  const storeName = branding?.name.trim().slice(0, 48) || "Oli Shop";
  const logoDataUrl = await getLogoDataUrl(branding?.logoUrl ?? null);
  const initial = storeName.slice(0, 1).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          position: "relative",
          overflow: "hidden",
          background: "#fff7fa",
          color: "#432631",
          padding: "54px 64px"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            right: -180,
            top: -220,
            borderRadius: 260,
            background: "#f7dce7",
            display: "flex"
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            left: -170,
            bottom: -240,
            borderRadius: 180,
            background: "#eadff4",
            display: "flex"
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 30px 0 10px"
          }}
        >
          <div style={{ color: "#bd6f84", fontSize: 24, fontWeight: 700, letterSpacing: 4, display: "flex" }}>
            CATÁLOGO DE BELLEZA
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, marginTop: 24, display: "flex" }}>
            {storeName}
          </div>
          <div style={{ color: "#765762", fontSize: 30, lineHeight: 1.25, marginTop: 24, display: "flex" }}>
            Pestañas, maquillaje y accesorios
          </div>
        </div>
        <div
          style={{
            width: 390,
            height: 390,
            alignSelf: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 48,
            border: "3px solid #f1c8d8",
            background: "#ffffff",
            overflow: "hidden"
          }}
        >
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" width={350} height={350} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ color: "#bd6f84", fontSize: 180, fontWeight: 800, display: "flex" }}>{initial}</div>
          )}
        </div>
      </div>
    ),
    shareImageSize
  );
}
