import { useCallback, useSyncExternalStore } from "react";

export type CartItem = {
  lineId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  selectedOptionIds: string[];
  optionLabels: string[];
  unitPrice: number;
};

// The cart lives in localStorage so it follows the shopper between the catalog and product
// pages, and survives a trip to WhatsApp. Every component reading a key sees the same array.
const EMPTY_CART: CartItem[] = [];
const snapshots = new Map<string, CartItem[]>();
const listeners = new Set<() => void>();

function isCartItem(value: unknown): value is CartItem {
  const item = value as CartItem;
  return Boolean(item) && typeof item.lineId === "string" && typeof item.productId === "string" && typeof item.productName === "string"
    && Number.isInteger(item.quantity) && item.quantity > 0 && Array.isArray(item.selectedOptionIds) && Array.isArray(item.optionLabels)
    && typeof item.unitPrice === "number";
}

function readCart(key: string) {
  const cached = snapshots.get(key);
  if (cached) return cached;
  let items = EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (Array.isArray(parsed)) items = parsed.filter(isCartItem);
  } catch {
    // Storage can be unavailable in private browsing; the cart then lasts while the page is open.
  }
  snapshots.set(key, items);
  return items;
}

function writeCart(key: string, items: CartItem[]) {
  snapshots.set(key, items);
  try {
    if (items.length) window.localStorage.setItem(key, JSON.stringify(items));
    else window.localStorage.removeItem(key);
  } catch {
    // Same as above: keep working in memory.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the cart: drop the cached copy so the next read picks it up.
  function handleStorage(event: StorageEvent) {
    if (event.key === null) snapshots.clear();
    else snapshots.delete(event.key);
    listener();
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useStoredCart(key: string) {
  const items = useSyncExternalStore(subscribe, () => readCart(key), () => EMPTY_CART);
  const setItems = useCallback((update: (current: CartItem[]) => CartItem[]) => writeCart(key, update(readCart(key))), [key]);
  return [items, setItems] as const;
}
