import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";

export const PRODUCT_SORTS = ["manual", "category", "name", "price", "newest", "promo", "random"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

// Orders shoppers can pick in the catalog; "recommended" keeps the store's own order.
export const SHOPPER_SORTS = ["recommended", "price", "price-desc", "name", "newest"] as const;
export type ShopperSort = (typeof SHOPPER_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, { title: string; hint: string }> = {
  manual: { title: "Manual", hint: "Arrastrá para elegir el orden." },
  category: { title: "Por categoría", hint: "Agrupados como tus categorías." },
  name: { title: "Alfabético", hint: "De la A a la Z." },
  price: { title: "Precio", hint: "Del más barato al más caro." },
  newest: { title: "Más nuevos primero", hint: "Lo último que cargaste, arriba." },
  promo: { title: "Ofertas primero", hint: "Los que tienen precio en oferta, arriba." },
  random: { title: "Aleatorio", hint: "Se mezclan en cada visita." }
};

export const SHOPPER_SORT_LABELS: Record<ShopperSort, string> = {
  recommended: "Recomendados",
  price: "Menor precio",
  "price-desc": "Mayor precio",
  name: "Nombre (A–Z)",
  newest: "Lo más nuevo"
};

export function normalizeProductSort(value: string | null | undefined): ProductSort {
  return PRODUCT_SORTS.includes(value as ProductSort) ? (value as ProductSort) : "manual";
}

export type OrderableProduct = {
  name: string;
  basePrice: number;
  promoPrice: number | null;
  stockQuantity: number | null;
  category: { id: string } | null;
  sortOrder: number;
  createdAt: string;
};

function manualCompare(a: OrderableProduct, b: OrderableProduct) {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
}

function nameCompare(a: OrderableProduct, b: OrderableProduct) {
  return a.name.localeCompare(b.name, "es-AR", { sensitivity: "base", numeric: true });
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function isSoldOut(product: Pick<OrderableProduct, "stockQuantity">) {
  return product.stockQuantity !== null && product.stockQuantity <= 0;
}

// Every order falls back to the manual one, so ties always land the same way.
export function orderProducts<T extends OrderableProduct>(
  products: T[],
  sort: ProductSort | Exclude<ShopperSort, "recommended">,
  { soldOutLast, categoryIds = [] }: { soldOutLast: boolean; categoryIds?: string[] }
) {
  const categoryRank = new Map(categoryIds.map((id, index) => [id, index]));
  const byManual = [...products].sort(manualCompare);
  let ordered: T[];
  switch (sort) {
    case "category":
      ordered = byManual.sort((a, b) => {
        const rankA = a.category ? categoryRank.get(a.category.id) ?? categoryIds.length : categoryIds.length + 1;
        const rankB = b.category ? categoryRank.get(b.category.id) ?? categoryIds.length : categoryIds.length + 1;
        return rankA - rankB || nameCompare(a, b);
      });
      break;
    case "name":
      ordered = byManual.sort(nameCompare);
      break;
    case "price":
      ordered = byManual.sort((a, b) => getEffectiveProductPrice(a) - getEffectiveProductPrice(b));
      break;
    case "price-desc":
      ordered = byManual.sort((a, b) => getEffectiveProductPrice(b) - getEffectiveProductPrice(a));
      break;
    case "newest":
      ordered = byManual.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "promo":
      ordered = byManual.sort((a, b) => Number(Boolean(getDiscountPercent(b))) - Number(Boolean(getDiscountPercent(a))));
      break;
    case "random":
      ordered = shuffle(byManual);
      break;
    default:
      ordered = byManual;
  }
  if (!soldOutLast) return ordered;
  return [...ordered.filter((product) => !isSoldOut(product)), ...ordered.filter(isSoldOut)];
}
