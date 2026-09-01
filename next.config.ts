import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next blocks dev-only client assets for unknown origins. This keeps the
  // public tunnel interactive while testing the storefront on a phone.
  allowedDevOrigins: ["*.ngrok-free.dev"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost"
      },
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
