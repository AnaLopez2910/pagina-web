export type StoreTemplate = "market" | "quick-menu" | "premium";

export function getEffectiveProductPrice(product: { basePrice: number; promoPrice?: number | null }) {
  return product.promoPrice && product.promoPrice > 0 && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
}

export function getDiscountPercent(product: { basePrice: number; promoPrice?: number | null }) {
  const effectivePrice = getEffectiveProductPrice(product);
  if (effectivePrice >= product.basePrice) {
    return null;
  }
  return Math.round((1 - effectivePrice / product.basePrice) * 100);
}

export function normalizeStoreTemplate(template: string | null | undefined): StoreTemplate {
  if (template === "quick-menu" || template === "premium") {
    return template;
  }
  return "market";
}
