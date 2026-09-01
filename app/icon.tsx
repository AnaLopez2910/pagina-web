import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  let logoSrc: string | null = null;

  try {
    const logo = await readFile(path.join(process.cwd(), "public", "logo-sin-fondo-y-letras.png"));
    logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    // Keep a usable fallback icon if the public asset is unavailable.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "transparent"
        }}
      >
        {logoSrc ? <img src={logoSrc} alt="" width={84} height={84} style={{ objectFit: "cover" }} /> : <span style={{ color: "#bd6f84", fontSize: 42, fontWeight: 800 }}>A</span>}
      </div>
    ),
    { ...size }
  );
}
