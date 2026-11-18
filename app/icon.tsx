import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  let logoSrc: string | null = null;

  try {
    const logo = await readFile(path.join(process.cwd(), "public", "amo-store-logo.jpg"));
    logoSrc = `data:image/jpeg;base64,${logo.toString("base64")}`;
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
        {logoSrc ? <img src={logoSrc} alt="" width={64} height={64} style={{ objectFit: "cover" }} /> : <span style={{ color: "#9b2752", fontSize: 42, fontWeight: 600 }}>A</span>}
      </div>
    ),
    { ...size }
  );
}
