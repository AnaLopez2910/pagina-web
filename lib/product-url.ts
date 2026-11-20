import { slugify } from "@/lib/slug";

// Product URLs are "<name>-<code>". The code never changes, so a link shared on
// WhatsApp keeps working after the product is renamed.
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 5;
// Every code carries a digit, which tells it apart from the last word of a name.
const CODE_PATTERN = /^(?=.*[0-9])[0-9a-z]{5}$/;

export function createProductCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  for (;;) {
    globalThis.crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    if (CODE_PATTERN.test(code)) return code;
  }
}

export function productSlugCode(slug: string) {
  const code = slug.slice(slug.lastIndexOf("-") + 1);
  return slug.includes("-") && CODE_PATTERN.test(code) ? code : null;
}

export function buildProductSlug(name: string, code: string) {
  return `${slugify(name) || "producto"}-${code}`;
}

export function productPath(slug: string, basePath = "") {
  return `${basePath}/product/${slug}`;
}

// Finds the product a URL points to: the exact slug, the same code under an older
// name or on its own (/product/k7f2q), or a link from before codes existed.
// Ambiguous matches resolve to nothing.
export function findProductBySlug<T extends { slug: string }>(products: T[], slug: string) {
  const exact = products.find((product) => product.slug === slug);
  if (exact) return exact;
  const code = productSlugCode(slug) ?? (CODE_PATTERN.test(slug) ? slug : null);
  const sameCode = code ? products.filter((product) => productSlugCode(product.slug) === code) : [];
  if (sameCode.length === 1) return sameCode[0];
  const legacy = products.filter((product) => product.slug.startsWith(`${slug}-`) && productSlugCode(product.slug) && product.slug.length === slug.length + CODE_LENGTH + 1);
  return legacy.length === 1 ? legacy[0] : null;
}
