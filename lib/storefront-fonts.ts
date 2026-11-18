import { Dancing_Script, Fredoka, Nunito } from "next/font/google";

// Storefront fonts: Fredoka for headings, Nunito for text and Dancing Script for small handwritten accents.
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-store-display" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-store-body" });
const dancingScript = Dancing_Script({ subsets: ["latin"], variable: "--font-store-script" });

export const storefrontFontClasses = `${fredoka.variable} ${nunito.variable} ${dancingScript.variable}`;
