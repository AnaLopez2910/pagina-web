import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#342635",
        muted: "#806f7d",
        line: "#f0dfe9",
        brand: "#c45782",
        brandDark: "#853353",
        surface: "#fff8fb",
        blush: "#f9dce9",
        lilac: "#eee4f8",
        champagne: "#f7e6c9"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(166, 76, 116, 0.12)",
        glow: "0 16px 42px rgba(196, 87, 130, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
