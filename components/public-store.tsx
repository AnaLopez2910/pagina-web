"use client";
/* eslint-disable @next/next/no-img-element */

import "@/app/storefront.css";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Check, ChevronLeft, ChevronRight, ImageIcon, MapPin, Maximize2, Minus, Plus, Search, Share2, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import { SectionTitle, StorefrontLayout, type CatalogCopy, type StorefrontView } from "@/components/storefront-layout";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { WhatsappIcon } from "@/components/whatsapp-icon";
import { useStoredCart, type CartItem } from "@/lib/cart-storage";
import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import { orderProducts, SHOPPER_SORT_LABELS, SHOPPER_SORTS, type ShopperSort } from "@/lib/product-order";
import { productPath } from "@/lib/product-url";
import type { PublicStore, StorefrontProduct } from "@/lib/catalog-data";
import { formatMoney } from "@/lib/money";
import { formatArgentineLocalPhone, isCompleteArgentineLocalPhone, isValidCustomerName } from "@/lib/store-settings";
import { storefrontFontClasses } from "@/lib/storefront-fonts";

const FALLBACK_HERO_IMAGE = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=88";
const LOW_STOCK_THRESHOLD = 5;
const PUBLIC_PRODUCT_BATCH_SIZE = 25;
const RELATED_PRODUCT_COUNT = 4;

// Becomes true once any store page has mounted in this tab. A product page that mounts
// after that was reached from inside the store, so its "Volver" can simply go back.
let storeVisited = false;

function calculateUnitPrice(product: StorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce((total, group) => total + group.options.reduce((sum, option) => selected.has(option.id) ? sum + option.priceDelta : sum, 0), getEffectiveProductPrice(product));
}

function optionSelectionKey(optionIds: string[]) {
  return JSON.stringify([...optionIds].sort());
}

// A saved cart can outlive a product, an option or a price: keep what still exists, at today's price.
function reconcileCart(items: CartItem[], products: StorefrontProduct[]) {
  return items.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product || product.stockQuantity === 0) return [];
    const availableOptionIds = new Set(product.optionGroups.flatMap((group) => group.options.filter((option) => option.isAvailable).map((option) => option.id)));
    if (!item.selectedOptionIds.every((id) => availableOptionIds.has(id))) return [];
    return [{ ...item, productName: product.name, imageUrl: product.imageUrls[0] ?? null, unitPrice: calculateUnitPrice(product, item.selectedOptionIds) }];
  });
}

function normalizeShopperSort(value: string | null): ShopperSort {
  return SHOPPER_SORTS.find((sort) => sort === value) ?? "recommended";
}

function pluralizeOptionName(name: string) {
  const lower = name.trim().toLocaleLowerCase("es-AR");
  if (/[aeiouáéíóú]$/.test(lower)) return `${lower}s`;
  if (lower.endsWith("z")) return `${lower.slice(0, -1)}ces`;
  return `${lower}es`;
}

// "3 tonos", "2 colores": tells shoppers a product comes in variants before they open it.
function optionHint(product: StorefrontProduct) {
  const group = product.optionGroups.find((item) => item.options.filter((option) => option.isAvailable).length > 1);
  if (!group) return null;
  return `${group.options.filter((option) => option.isAvailable).length} ${pluralizeOptionName(group.name)}`;
}

// A group is shown as colour circles only when every available value has a colour.
function isColorGroup(group: StorefrontProduct["optionGroups"][number]) {
  const available = group.options.filter((option) => option.isAvailable);
  return available.length > 0 && available.every((option) => option.colorHex);
}

function isLightColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

function whatsappHref(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return normalized ? `https://wa.me/${normalized}` : "#";
}

type PublicStoreProps = {
  store: PublicStore;
  products: StorefrontProduct[];
  // Set on a product page: the page shows this product instead of the catalog.
  product?: StorefrontProduct | null;
  productUrl?: string | null;
  // "/demo" for the local preview, so links stay inside it.
  basePath?: string;
  preview?: boolean;
};

export function PublicStore({ store, products, product: pageProduct = null, productUrl = null, basePath = "", preview = false }: PublicStoreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const homeHref = basePath || "/";
  // Catalog filters start from the URL, so going back from a product returns to the same view.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(() => {
    const value = searchParams.get("categoria");
    return value === "promos" || store.categories.some((item) => item.slug === value) ? value as string : "all";
  });
  const [visibleProductLimit, setVisibleProductLimit] = useState(PUBLIC_PRODUCT_BATCH_SIZE);
  const [productLimitRestored, setProductLimitRestored] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const justAddedTimer = useRef<number | undefined>(undefined);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [storedCart, setStoredCart] = useStoredCart(`catalog:${store.slug}:cart`);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [shopperSort, setShopperSort] = useState<ShopperSort>(() => normalizeShopperSort(searchParams.get("orden")));
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const queryUrlTimer = useRef<number | undefined>(undefined);
  const photoTouchStart = useRef<number | null>(null);
  const photoSwiped = useRef(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Zoom doubles the photo around the spot that was tapped (x/y in percent).
  const [viewerZoom, setViewerZoom] = useState<{ x: number; y: number } | null>(null);
  const viewerPointer = useRef<{ x: number; y: number } | null>(null);
  const viewerLastTap = useRef(0);
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimer = useRef<number | undefined>(undefined);
  const cameFromStore = useRef<boolean | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("Punto de encuentro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicVisible, setMagicVisible] = useState(false);
  const productErrorRef = useRef<HTMLParagraphElement>(null);
  const cartErrorRef = useRef<HTMLParagraphElement>(null);

  const heroImages = useMemo(() => store.heroImageUrls.length ? store.heroImageUrls : [FALLBACK_HERO_IMAGE], [store.heroImageUrls]);
  const categories = store.categories;
  const hasPromos = products.some((product) => getDiscountPercent(product));
  const bestDiscount = products.reduce<number | null>((best, product) => Math.max(best ?? 0, getDiscountPercent(product) ?? 0) || null, null);
  const categoryCounts = useMemo(() => products.reduce<Record<string, number>>((counts, product) => {
    if (product.category) counts[product.category.slug] = (counts[product.category.slug] ?? 0) + 1;
    return counts;
  }, {}), [products]);
  const categoryCovers = useMemo(() => products.reduce<Record<string, string | null>>((covers, product) => {
    if (product.category && !covers[product.category.slug]) covers[product.category.slug] = product.imageUrls[0] ?? null;
    return covers;
  }, {}), [products]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  const filteredProducts = useMemo(() => products.filter((product) => {
    const searchableText = [product.name, product.description ?? "", product.category?.name ?? ""].join(" ").toLocaleLowerCase("es-AR");
    const matchesQuery = searchableText.includes(normalizedQuery);
    const matchesCategory = category === "all" || (category === "promos" && Boolean(getDiscountPercent(product))) || product.category?.slug === category;
    return matchesQuery && matchesCategory;
  }), [category, normalizedQuery, products]);
  // "Recomendados" keeps the order chosen in the admin; the rest sort on top of it.
  const sortedProducts = useMemo(
    () => shopperSort === "recommended" ? filteredProducts : orderProducts(filteredProducts, shopperSort, { soldOutLast: store.soldOutLast }),
    [filteredProducts, shopperSort, store.soldOutLast]
  );
  // Same category first, then the rest of the catalog in the store's order.
  const relatedProducts = useMemo(() => {
    if (!pageProduct) return [];
    const others = products.filter((product) => product.id !== pageProduct.id);
    const sameCategory = others.filter((product) => pageProduct.category && product.category?.id === pageProduct.category.id);
    return [...sameCategory, ...others.filter((product) => !sameCategory.includes(product))].slice(0, RELATED_PRODUCT_COUNT);
  }, [pageProduct, products]);
  const visibleProductLimitKey = `catalog:${store.slug}:visible-products`;
  const visibleProducts = sortedProducts.slice(0, visibleProductLimit);
  const remainingProductCount = Math.max(0, sortedProducts.length - visibleProducts.length);
  const cart = useMemo(() => reconcileCart(storedCart, products), [products, storedCart]);
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // An emptied cart can't stay on the details step.
  const currentCheckoutStep = cart.length ? checkoutStep : 1;

  useLockBodyScroll(checkoutOpen || magicVisible || sortMenuOpen || viewerOpen);

  // Layers stacked over the page, bottom to top. Each one gets its own history entry,
  // so the phone's back button closes the top layer instead of leaving the page.
  const openLayers = [
    checkoutOpen && "cart",
    checkoutOpen && currentCheckoutStep === 2 && "checkout-details",
    sortMenuOpen && "sort",
    viewerOpen && "viewer"
  ].filter((layer): layer is string => Boolean(layer));
  const layerDepth = openLayers.length;
  const historyLayers = useRef(0);
  // A filter changed while a layer was open waits until that layer's history entry is gone.
  const pendingCatalogUrl = useRef<string | null>(null);

  useEffect(() => {
    const pushed = historyLayers.current;
    for (let layer = pushed + 1; layer <= layerDepth; layer += 1) window.history.pushState({ storeLayer: layer }, "");
    // Closed with a button or Escape: drop the entries it left behind.
    if (layerDepth < pushed) window.history.go(layerDepth - pushed);
    historyLayers.current = layerDepth;
  }, [layerDepth]);

  const handlePopState = useEffectEvent((event: PopStateEvent) => {
    const layer = typeof event.state?.storeLayer === "number" ? event.state.storeLayer : 0;
    // Forward into a layer that is already closed: step back to where the page really is.
    if (layer > openLayers.length) {
      window.history.go(openLayers.length - layer);
      return;
    }
    historyLayers.current = layer;
    const closing = openLayers.slice(layer);
    if (closing.includes("viewer")) closeViewer();
    if (closing.includes("sort")) setSortMenuOpen(false);
    if (closing.includes("checkout-details")) setCheckoutStep(1);
    if (closing.includes("cart")) setCheckoutOpen(false);
    if (layer === 0 && pendingCatalogUrl.current) {
      window.history.replaceState(null, "", pendingCatalogUrl.current);
      pendingCatalogUrl.current = null;
    }
  });

  // Registered once: Next re-renders the page while handling the same popstate event, and a
  // listener swapped out by that render would miss the event.
  useEffect(() => {
    function listener(event: PopStateEvent) {
      handlePopState(event);
    }
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  useEffect(() => {
    cameFromStore.current ??= storeVisited;
    storeVisited = true;
  }, []);

  useEffect(() => {
    let restoredLimit = PUBLIC_PRODUCT_BATCH_SIZE;
    try {
      const storedLimit = Number(window.localStorage.getItem(visibleProductLimitKey));
      if (Number.isInteger(storedLimit) && storedLimit >= PUBLIC_PRODUCT_BATCH_SIZE) {
        restoredLimit = Math.min(storedLimit, Math.max(PUBLIC_PRODUCT_BATCH_SIZE, products.length));
      }
    } catch {
      // Storage can be unavailable in private browsing; the catalog still works in memory.
    }
    setVisibleProductLimit(restoredLimit);
    setProductLimitRestored(true);
  }, [products.length, visibleProductLimitKey]);

  useEffect(() => {
    if (!productLimitRestored) return;
    try {
      window.localStorage.setItem(visibleProductLimitKey, String(visibleProductLimit));
    } catch {
      // Storage can be unavailable in private browsing; the catalog still works in memory.
    }
  }, [productLimitRestored, visibleProductLimit, visibleProductLimitKey]);

  useEffect(() => () => {
    window.clearTimeout(justAddedTimer.current);
    window.clearTimeout(shareCopiedTimer.current);
    window.clearTimeout(queryUrlTimer.current);
  }, []);

  useEffect(() => {
    if (heroImages.length < 2 || heroPaused || pageProduct) return;
    const interval = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroImages.length), 5000);
    return () => window.clearInterval(interval);
  }, [heroImages.length, heroPaused, pageProduct]);

  useEffect(() => {
    if (!checkoutOpen && !sortMenuOpen && !viewerOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      // The photo viewer sits on top of everything: Escape closes only the viewer and arrows move between photos.
      if (viewerOpen && pageProduct) {
        if (event.key === "Escape") closeViewer();
        else if (event.key === "ArrowRight") showViewerImage(activeImageIndex + 1);
        else if (event.key === "ArrowLeft") showViewerImage(activeImageIndex - 1);
        return;
      }
      if (event.key !== "Escape") return;
      setCheckoutOpen(false);
      setSortMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!pageProduct || checkoutOpen || !error) return;
    const frame = window.requestAnimationFrame(() => {
      productErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pageProduct, checkoutOpen, error]);

  useEffect(() => {
    if (!checkoutOpen || !error) return;
    const frame = window.requestAnimationFrame(() => {
      cartErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [checkoutOpen, error]);

  function setCart(update: (current: CartItem[]) => CartItem[]) {
    setStoredCart((current) => update(reconcileCart(current, products)));
  }

  function scrollCheckoutFieldIntoView(event: FocusEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    window.setTimeout(() => field.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }), 250);
  }

  function remainingStock(product: StorefrontProduct) {
    if (product.stockQuantity === null) return null;
    return product.stockQuantity - cart.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
  }

  function isOutOfStock(product: StorefrontProduct) {
    const remaining = remainingStock(product);
    return remaining !== null && remaining <= 0;
  }

  function toggleOption(group: StorefrontProduct["optionGroups"][number], optionId: string) {
    setError("");
    setSelectedOptionIds((current) => {
      if (group.selectionType === "SINGLE") return [...current.filter((id) => !group.options.some((option) => option.id === id)), optionId];
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      const selectedInGroup = current.filter((id) => group.options.some((option) => option.id === id));
      if (group.maxSelections && selectedInGroup.length >= group.maxSelections) {
        setError(`Máximo ${group.maxSelections} opción(es) en ${group.name}`);
        return current;
      }
      return [...current, optionId];
    });
  }

  function addProductToCart(product: StorefrontProduct, optionIds: string[], amount = 1) {
    if (isOutOfStock(product)) {
      setError("No hay stock disponible para este producto.");
      return false;
    }
    const remaining = remainingStock(product);
    if (remaining !== null && amount > remaining) {
      setError(remaining === 1 ? "Solo queda 1 unidad." : `Solo quedan ${remaining} unidades.`);
      return false;
    }
    for (const group of product.optionGroups) {
      const selectedInGroup = optionIds.filter((id) => group.options.some((option) => option.id === id));
      if (group.isRequired && selectedInGroup.length === 0) {
        setError(`Falta seleccionar ${group.name}`);
        return false;
      }
      if (group.maxSelections && selectedInGroup.length > group.maxSelections) {
        setError(`Máximo ${group.maxSelections} opción(es) en ${group.name}`);
        return false;
      }
    }
    const normalizedOptionIds = [...optionIds].sort();
    const optionKey = optionSelectionKey(normalizedOptionIds);
    const optionLabels = product.optionGroups.flatMap((group) => group.options.filter((option) => normalizedOptionIds.includes(option.id)).map((option) => `${group.name}: ${option.name}`));
    const lineId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCart((current) => {
      const existingItem = current.find((item) => item.productId === product.id && optionSelectionKey(item.selectedOptionIds) === optionKey);
      if (existingItem) {
        return current.map((item) => item.lineId === existingItem.lineId ? { ...item, quantity: item.quantity + amount } : item);
      }
      return [...current, {
        lineId,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrls[0] ?? null,
        quantity: amount,
        selectedOptionIds: normalizedOptionIds,
        optionLabels,
        unitPrice: calculateUnitPrice(product, normalizedOptionIds)
      }];
    });
    setError("");
    return true;
  }

  function flashAdded(productId: string) {
    setJustAddedId(productId);
    window.clearTimeout(justAddedTimer.current);
    justAddedTimer.current = window.setTimeout(() => setJustAddedId(null), 1400);
  }

  function addPageProduct() {
    if (!pageProduct || !addProductToCart(pageProduct, selectedOptionIds, quantity)) return;
    setQuantity(1);
    flashAdded(pageProduct.id);
  }

  function changeQuantity(delta: number) {
    if (!pageProduct) return;
    const remaining = remainingStock(pageProduct);
    const max = remaining === null ? 99 : Math.max(1, remaining);
    setQuantity((current) => Math.min(max, Math.max(1, current + delta)));
  }

  function addCardProduct(product: StorefrontProduct) {
    if (product.optionGroups.length) {
      saveCatalogUrl();
      router.push(productPath(product.slug, basePath));
      return;
    }
    if (!addProductToCart(product, [])) return;
    flashAdded(product.id);
  }

  function updateQuantity(lineId: string, delta: number) {
    setCart((current) => current.map((item) => {
      if (item.lineId !== lineId) return item;
      if (delta > 0) {
        const product = products.find((candidate) => candidate.id === item.productId);
        const productQuantity = current.filter((currentItem) => currentItem.productId === item.productId).reduce((sum, currentItem) => sum + currentItem.quantity, 0);
        if (product?.stockQuantity !== null && product?.stockQuantity !== undefined && productQuantity >= product.stockQuantity) {
          setError("No hay más stock disponible para este producto.");
          return item;
        }
      }
      return { ...item, quantity: Math.max(0, item.quantity + delta) };
    }).filter((item) => item.quantity > 0));
  }

  // Filters live in the URL, so a filtered view survives going to a product and back, and can be shared.
  function updateCatalogUrl(changes: Record<string, string | null>) {
    const url = new URL(pendingCatalogUrl.current ?? window.location.href, window.location.origin);
    for (const [key, value] of Object.entries(changes)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    // With a layer open the current history entry is the layer's, which is about to be dropped.
    if (historyLayers.current > 0) pendingCatalogUrl.current = next;
    else window.history.replaceState(null, "", next);
  }

  // The search box writes to the URL after a pause; leaving for a product writes it right away.
  function saveCatalogUrl() {
    if (queryUrlTimer.current === undefined) return;
    window.clearTimeout(queryUrlTimer.current);
    queryUrlTimer.current = undefined;
    updateCatalogUrl({ q: query.trim() || null });
  }

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
    updateCatalogUrl({ categoria: nextCategory === "all" ? null : nextCategory });
    window.setTimeout(() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateProductQuery(nextQuery: string) {
    setQuery(nextQuery);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
    window.clearTimeout(queryUrlTimer.current);
    queryUrlTimer.current = window.setTimeout(() => {
      queryUrlTimer.current = undefined;
      updateCatalogUrl({ q: nextQuery.trim() || null });
    }, 400);
  }

  function chooseShopperSort(nextSort: ShopperSort) {
    setShopperSort(nextSort);
    setSortMenuOpen(false);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
    updateCatalogUrl({ orden: nextSort === "recommended" ? null : nextSort });
  }

  function openCart() {
    setCheckoutStep(1);
    setError("");
    setCheckoutOpen(true);
  }

  // Coming from the catalog, "Volver" returns to it where the shopper left off; from a shared link it opens the catalog.
  function goBackToStore(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!cameFromStore.current || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.back();
  }

  async function shareProduct() {
    if (!pageProduct) return;
    const url = productUrl ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: pageProduct.name, text: `${pageProduct.name} · ${formatMoney(getEffectiveProductPrice(pageProduct))}`, url });
      } catch {
        // The shopper closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.clearTimeout(shareCopiedTimer.current);
      shareCopiedTimer.current = window.setTimeout(() => setShareCopied(false), 2200);
    } catch {
      window.prompt("Copiá el link del producto", url);
    }
  }

  function showProductImage(index: number) {
    if (!pageProduct?.imageUrls.length) return;
    const count = pageProduct.imageUrls.length;
    setActiveImageIndex((index + count) % count);
  }

  function openViewer() {
    if (!pageProduct?.imageUrls.length) return;
    setViewerZoom(null);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
    setViewerZoom(null);
  }

  function showViewerImage(index: number) {
    setViewerZoom(null);
    showProductImage(index);
  }

  function startViewerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    viewerPointer.current = { x: event.clientX, y: event.clientY };
  }

  // One gesture handler for mouse and touch: a horizontal swipe changes photo, a double tap toggles zoom.
  function endViewerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const start = viewerPointer.current;
    viewerPointer.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (!viewerZoom && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
      showViewerImage(activeImageIndex + (dx < 0 ? 1 : -1));
      return;
    }
    if (Math.abs(dx) > 10 || !(event.target instanceof HTMLImageElement)) return;
    const now = Date.now();
    if (now - viewerLastTap.current < 320) {
      viewerLastTap.current = 0;
      if (viewerZoom) {
        setViewerZoom(null);
      } else {
        const rect = event.target.getBoundingClientRect();
        setViewerZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
      }
      return;
    }
    viewerLastTap.current = now;
  }

  function goToCheckoutDetails() {
    if (!cart.length) return;
    setError("");
    setCheckoutStep(2);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store.availability.isOpen) {
      setError(store.availability.label);
      return;
    }
    if (!cart.length) {
      setError("Agregá al menos un producto al carrito.");
      return;
    }
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!isValidCustomerName(name)) {
      setError("Ingresá un nombre válido.");
      return;
    }
    if (!isCompleteArgentineLocalPhone(phone)) {
      setError("Ingresá un teléfono válido.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const address = String(form.get("address") ?? "").trim();
    if (deliveryType === "Envío" && !address) {
      setError("Ingresá una dirección de entrega.");
      return;
    }
    if (preview) {
      setError("Vista previa: en esta demo los pedidos no se envían.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeSlug: store.slug,
        customerName: name,
        customerPhone: phone,
        fulfillment: deliveryType,
        address: deliveryType === "Envío" ? address : null,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, selectedOptionIds: item.selectedOptionIds }))
      })
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el pedido.");
      return;
    }
    // The cart is saved on the device: empty it so coming back from WhatsApp doesn't offer the same order again.
    setCart(() => []);
    setMagicVisible(true);
    window.setTimeout(() => { window.location.href = data.whatsappUrl; }, 2100);
  }

  const publicWhatsapp = whatsappHref(store.whatsappPhone);

  function renderProductCard(product: StorefrontProduct) {
    const href = productPath(product.slug, basePath);
    const outOfStock = isOutOfStock(product);
    const remaining = remainingStock(product);
    const discount = getDiscountPercent(product);
    const lowStock = !outOfStock && remaining !== null && remaining <= LOW_STOCK_THRESHOLD;
    const justAdded = justAddedId === product.id;
    const hint = optionHint(product);
    const addLabel = justAdded ? "Agregado" : product.optionGroups.length ? "Elegir opciones" : "Agregar al carrito";
    return (
      <article className={`mn-card ${outOfStock ? "is-out" : ""}`} key={product.id}>
        <div className="mn-card-media">
          {/* The photo opens the product too; the name below is the focusable link */}
          <Link className="mn-card-photo" href={href} onClick={saveCatalogUrl} tabIndex={-1} aria-hidden="true">
            {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt="" loading="lazy" /> : <ImageIcon size={28} aria-hidden="true" />}
          </Link>
          {discount || lowStock || outOfStock ? (
            <span className="mn-card-stickers">
              {discount && !outOfStock ? <span className="mn-sticker">-{discount}%</span> : null}
              {lowStock ? <span className="mn-sticker soft">{remaining === 1 ? "Queda 1" : `Quedan ${remaining}`}</span> : null}
              {outOfStock ? <span className="mn-sticker muted">Sin stock</span> : null}
            </span>
          ) : null}
          {!outOfStock ? (
            <button className={`mn-card-add ${justAdded ? "is-added" : ""}`} onClick={() => addCardProduct(product)} aria-label={`${addLabel}: ${product.name}`} type="button">
              {justAdded ? <Check size={20} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={20} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          ) : null}
        </div>
        <Link className="mn-card-info" href={href} onClick={saveCatalogUrl}>
          <span className="mn-card-cat">{product.category?.name ?? "Producto"}</span>
          <span className="mn-card-name">{product.name}</span>
          <span className="mn-card-meta">
            <span className="mn-price-tag">{formatMoney(getEffectiveProductPrice(product))}</span>
            {discount ? <s>{formatMoney(product.basePrice)}</s> : null}
            {hint ? <span className="mn-card-hint">{hint}</span> : null}
          </span>
        </Link>
      </article>
    );
  }

  function renderCatalog(copy: CatalogCopy) {
    return (
      <section id="productos" className="catalog">
        <div className="container">
          <div className="catalog-head">
            <SectionTitle eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
            <div className="product-tools">
              <div className="mn-search-row">
                <label className="store-search">
                  <Search size={17} aria-hidden="true" />
                  <input type="search" value={query} onChange={(event) => updateProductQuery(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" />
                </label>
                <div className="mn-sort">
                  <button className={`mn-sort-btn ${shopperSort !== "recommended" ? "is-on" : ""}`} onClick={() => setSortMenuOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={sortMenuOpen} type="button">
                    <ArrowUpDown size={16} aria-hidden="true" />
                    {shopperSort === "recommended" ? "Ordenar" : SHOPPER_SORT_LABELS[shopperSort]}
                  </button>
                  {sortMenuOpen ? <>
                    <div className="mn-sort-backdrop" onClick={() => setSortMenuOpen(false)} aria-hidden="true" />
                    <div className="mn-sort-menu" role="dialog" aria-label="Ordenar productos">
                      <span className="mn-sort-title">Ordenar por</span>
                      {SHOPPER_SORTS.map((sort) => (
                        <button key={sort} className={`mn-sort-option ${shopperSort === sort ? "is-on" : ""}`} onClick={() => chooseShopperSort(sort)} aria-pressed={shopperSort === sort} type="button">
                          {SHOPPER_SORT_LABELS[sort]}
                          {shopperSort === sort ? <Check size={17} aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  </> : null}
                </div>
              </div>
              <div className="chips" role="group" aria-label="Filtrar productos">
                <button className={`chip ${category === "all" ? "active" : ""}`} aria-pressed={category === "all"} onClick={() => selectCategory("all")} type="button">Todos</button>
                {hasPromos ? <button className={`chip ${category === "promos" ? "active" : ""}`} aria-pressed={category === "promos"} onClick={() => selectCategory("promos")} type="button">Promos</button> : null}
                {categories.map((item) => <button className={`chip ${category === item.slug ? "active" : ""}`} aria-pressed={category === item.slug} key={item.id} onClick={() => selectCategory(item.slug)} type="button">{item.name}</button>)}
              </div>
            </div>
          </div>

          <div className={`product-grid mobile-cols-${store.mobileProductColumns}`}>
            {visibleProducts.map(renderProductCard)}
          </div>
          {!sortedProducts.length ? <div className="empty-state">No encontramos productos con esos filtros.</div> : null}
          {sortedProducts.length ? (
            <div className="catalog-foot" aria-live="polite">
              <p>Mostrando {visibleProducts.length} de {sortedProducts.length} productos</p>
              {remainingProductCount > 0 ? <button className="btn btn-primary" onClick={() => setVisibleProductLimit((current) => Math.min(current + PUBLIC_PRODUCT_BATCH_SIZE, sortedProducts.length))} type="button"><Plus size={18} /> Ver más productos</button> : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderProductPage() {
    if (!pageProduct) return null;
    const item = pageProduct;
    const images = item.imageUrls;
    const outOfStock = isOutOfStock(item);
    const remaining = remainingStock(item);
    const discount = getDiscountPercent(item);
    const added = justAddedId === item.id;
    const consultHref = store.whatsappPhone ? `${publicWhatsapp}?text=${encodeURIComponent(`¡Hola! Quiero consultar por ${item.name}${productUrl ? `: ${productUrl}` : ""}`)}` : null;
    return (
      <>
        <div className="container mn-pdp-page">
          <nav className="mn-crumbs" aria-label="Estás en">
            <Link className="mn-crumbs-back" href={homeHref} onClick={goBackToStore}><ArrowLeft size={17} aria-hidden="true" /> Volver</Link>
            <ol>
              <li><Link href={homeHref}>Inicio</Link></li>
              {item.category ? <li><Link href={`${homeHref}?categoria=${item.category.slug}#productos`}>{item.category.name}</Link></li> : null}
              <li aria-current="page">{item.name}</li>
            </ol>
          </nav>

          <div className="mn-pdp">
            <div className="mn-pdp-media">
              <div
                className={`mn-pdp-photo ${images.length ? "can-expand" : ""}`}
                onClick={(event) => {
                  if (photoSwiped.current || event.target !== event.currentTarget && !(event.target instanceof HTMLImageElement)) return;
                  openViewer();
                }}
                onTouchStart={(event) => { photoTouchStart.current = event.touches[0]?.clientX ?? null; photoSwiped.current = false; }}
                onTouchEnd={(event) => {
                  const start = photoTouchStart.current;
                  const end = event.changedTouches[0]?.clientX;
                  photoTouchStart.current = null;
                  if (start === null || end === undefined || Math.abs(end - start) < 40) return;
                  photoSwiped.current = true;
                  showProductImage(activeImageIndex + (end < start ? 1 : -1));
                }}
              >
                {images.length ? <img src={images[activeImageIndex] ?? images[0]} alt={`${item.name}, foto ${activeImageIndex + 1}`} /> : <ImageIcon size={40} aria-hidden="true" />}
                {discount && !outOfStock ? <span className="mn-pdp-badge">-{discount}%</span> : null}
                {images.length ? <button className="mn-pdp-expand" onClick={openViewer} type="button"><Maximize2 size={15} aria-hidden="true" /> Ver completa</button> : null}
                {images.length > 1 ? <>
                  <button className="mn-pdp-arrow is-prev" onClick={() => showProductImage(activeImageIndex - 1)} aria-label="Foto anterior" type="button"><ChevronLeft size={20} /></button>
                  <button className="mn-pdp-arrow is-next" onClick={() => showProductImage(activeImageIndex + 1)} aria-label="Foto siguiente" type="button"><ChevronRight size={20} /></button>
                  <span className="mn-pdp-counter" aria-hidden="true">{activeImageIndex + 1} / {images.length}</span>
                </> : null}
              </div>
              {images.length > 1 ? (
                <div className="mn-thumbs" role="group" aria-label="Fotos del producto">
                  {images.map((url, index) => (
                    <button key={`${url}-${index}`} className={index === activeImageIndex ? "is-on" : ""} onClick={() => setActiveImageIndex(index)} aria-label={`Ver foto ${index + 1}`} aria-pressed={index === activeImageIndex} type="button">
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mn-pdp-info">
              <span className="mn-pdp-cat">{item.category?.name ?? "Producto"}</span>
              <h1>{item.name}</h1>
              <div className="mn-pdp-price">
                <strong>{formatMoney(getEffectiveProductPrice(item))}</strong>
                {discount ? <><s>{formatMoney(item.basePrice)}</s><span className="mn-pdp-off">-{discount}%</span></> : null}
              </div>
              {remaining !== null ? <p className={`mn-pdp-stock ${outOfStock ? "out" : ""}`}>{outOfStock ? "Sin stock" : remaining <= LOW_STOCK_THRESHOLD ? (remaining === 1 ? "¡Queda 1!" : `¡Quedan ${remaining}!`) : `${remaining} disponibles`}</p> : null}
              {item.description ? <p className="mn-pdp-desc">{item.description}</p> : null}
              {item.optionGroups.map((group) => {
                const available = group.options.filter((option) => option.isAvailable);
                const chosen = available.filter((option) => selectedOptionIds.includes(option.id)).map((option) => option.name).join(", ");
                const asColors = isColorGroup(group);
                return (
                  <fieldset className="mn-pdp-group" key={group.id}>
                    <legend>{group.name} <span>· {chosen || (group.selectionType === "SINGLE" ? "elegí uno" : group.maxSelections ? `elegí hasta ${group.maxSelections}` : "elegí los que quieras")}</span></legend>
                    <div className={asColors ? "mn-swatches" : "mn-chips"}>
                      {available.map((option) => {
                        const checked = selectedOptionIds.includes(option.id);
                        const input = <input className="sr-only" type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={checked} onChange={() => toggleOption(group, option.id)} />;
                        return asColors && option.colorHex ? (
                          <label key={option.id} className={`mn-swatch ${checked ? "is-on" : ""}`}>
                            {input}
                            <span className={`mn-swatch-dot ${isLightColor(option.colorHex) ? "is-light" : ""}`} style={{ "--swatch": option.colorHex } as CSSProperties}>{checked ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}</span>
                            <span className="mn-swatch-name">{option.name}</span>
                            {option.priceDelta ? <span className="mn-swatch-price">+{formatMoney(option.priceDelta)}</span> : null}
                          </label>
                        ) : (
                          <label key={option.id} className={`mn-chip ${checked ? "is-on" : ""}`}>
                            {input}
                            {checked ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : null}
                            {option.name}
                            {option.priceDelta ? <span className="mn-chip-price">+{formatMoney(option.priceDelta)}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
              {error && !checkoutOpen ? <p ref={productErrorRef} className="form-error" role="alert">{error}</p> : null}
              <div className="mn-pdp-buy">
                {!outOfStock ? (
                  <div className="mn-stepper" role="group" aria-label="Cantidad">
                    <button onClick={() => changeQuantity(-1)} disabled={quantity <= 1} aria-label="Restar una unidad" type="button"><Minus size={16} /></button>
                    <strong aria-live="polite">{quantity}</strong>
                    <button onClick={() => changeQuantity(1)} disabled={remaining !== null && quantity >= remaining} aria-label="Sumar una unidad" type="button"><Plus size={16} /></button>
                  </div>
                ) : null}
                <button className={`mn-pdp-cta ${added ? "is-added" : ""}`} onClick={addPageProduct} disabled={outOfStock} type="button">
                  {outOfStock ? "Sin stock" : added ? <><Check size={18} strokeWidth={2.6} aria-hidden="true" /> Agregado al carrito</> : `Agregar · ${formatMoney(calculateUnitPrice(item, selectedOptionIds) * quantity)}`}
                </button>
              </div>
              <div className="mn-pdp-share">
                <button className="mn-pdp-share-btn" onClick={shareProduct} type="button">
                  {shareCopied ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
                  {shareCopied ? "Link copiado" : "Compartir"}
                </button>
                {consultHref ? <a className="mn-pdp-share-btn" href={consultHref} target="_blank" rel="noreferrer"><WhatsappIcon className="h-[17px] w-[17px]" aria-hidden="true" /> Consultar</a> : null}
              </div>
            </div>
          </div>
        </div>

        {relatedProducts.length ? (
          <section className="mn-related" aria-labelledby="related-title">
            <div className="container">
              <div className="section-title">
                <span className="section-eyebrow">para combinar</span>
                <h2 id="related-title">También te puede gustar</h2>
              </div>
              <div className={`product-grid mobile-cols-${store.mobileProductColumns}`}>
                {relatedProducts.map(renderProductCard)}
              </div>
            </div>
          </section>
        ) : null}
      </>
    );
  }

  const view: StorefrontView = {
    store,
    heroImages,
    heroIndex,
    showHeroImage: setHeroIndex,
    heroPauseHandlers: {
      onMouseEnter: () => setHeroPaused(true),
      onMouseLeave: () => setHeroPaused(false),
      onFocus: () => setHeroPaused(true),
      onBlur: () => setHeroPaused(false)
    },
    hasPromos,
    bestDiscount,
    categoryCounts,
    categoryCovers,
    cartCount,
    openCart,
    selectCategory,
    whatsappUrl: publicWhatsapp,
    homeHref,
    renderCatalog,
    renderPage: pageProduct ? renderProductPage : undefined
  };

  return (
    <div className={`public-store ${storefrontFontClasses}`}>
      <StorefrontLayout view={view} />

      {cartCount > 0 && !checkoutOpen ? <button className="cart-summary" onClick={openCart} aria-label={`Ver carrito, ${cartCount} producto(s), total ${formatMoney(cartTotal)}`} type="button"><span className="cart-summary-label"><ShoppingCart size={18} /><span>Ver carrito · {cartCount} producto(s)</span></span><strong>{formatMoney(cartTotal)}</strong></button> : null}

      {pageProduct && viewerOpen && pageProduct.imageUrls.length ? (
        <div className="mn-viewer" role="dialog" aria-modal="true" aria-label={`Fotos de ${pageProduct.name}`}>
          <div className="mn-viewer-top">
            <span className="mn-viewer-count">{activeImageIndex + 1} / {pageProduct.imageUrls.length}</span>
            <span className="mn-viewer-name">{pageProduct.name}</span>
            <button className="mn-viewer-btn" onClick={closeViewer} aria-label="Cerrar fotos" type="button" autoFocus><X size={20} /></button>
          </div>
          <div className="mn-viewer-stage" onPointerDown={startViewerGesture} onPointerUp={endViewerGesture} onPointerCancel={() => { viewerPointer.current = null; }}>
            <img
              key={activeImageIndex}
              src={pageProduct.imageUrls[activeImageIndex] ?? pageProduct.imageUrls[0]}
              alt={`${pageProduct.name}, foto ${activeImageIndex + 1}`}
              className={viewerZoom ? "is-zoomed" : ""}
              style={viewerZoom ? { transformOrigin: `${viewerZoom.x}% ${viewerZoom.y}%` } : undefined}
              draggable={false}
            />
            {pageProduct.imageUrls.length > 1 ? <>
              <button className="mn-viewer-btn mn-viewer-arrow is-prev" onPointerUp={(event) => event.stopPropagation()} onClick={() => showViewerImage(activeImageIndex - 1)} aria-label="Foto anterior" type="button"><ChevronLeft size={22} /></button>
              <button className="mn-viewer-btn mn-viewer-arrow is-next" onPointerUp={(event) => event.stopPropagation()} onClick={() => showViewerImage(activeImageIndex + 1)} aria-label="Foto siguiente" type="button"><ChevronRight size={22} /></button>
            </> : null}
          </div>
          <div className="mn-viewer-bottom">
            {pageProduct.imageUrls.length > 1 ? (
              <div className="mn-viewer-thumbs" role="group" aria-label="Elegir foto">
                {pageProduct.imageUrls.map((url, index) => (
                  <button key={`${url}-${index}`} className={index === activeImageIndex ? "is-on" : ""} onClick={() => showViewerImage(index)} aria-label={`Ver foto ${index + 1}`} aria-pressed={index === activeImageIndex} type="button">
                    <img src={url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mn-viewer-hint"><span className="is-desktop">Doble clic para hacer zoom · Esc para cerrar</span><span className="is-touch">Deslizá para ver más · doble toque para zoom</span></p>
          </div>
        </div>
      ) : null}

      <div className={"cart-backdrop " + (checkoutOpen ? "open" : "")} onClick={() => setCheckoutOpen(false)} aria-hidden={!checkoutOpen} />
      <aside className={"cart-drawer " + (checkoutOpen ? "open" : "")} role="dialog" aria-modal="true" aria-label="Carrito" aria-hidden={!checkoutOpen}>
        <div className="ck-head">
          {currentCheckoutStep === 1
            ? <h3>Tu carrito</h3>
            : <button className="ck-back" onClick={() => setCheckoutStep(1)} type="button"><ArrowLeft size={18} aria-hidden="true" /> Volver</button>}
          <button className="close-btn" onClick={() => setCheckoutOpen(false)} aria-label="Cerrar carrito" type="button"><X /></button>
        </div>
        <ol className="ck-steps" aria-label="Pasos del pedido">
          <li className="is-on" aria-current={currentCheckoutStep === 1 ? "step" : undefined}>Productos</li>
          <li className={currentCheckoutStep === 2 ? "is-on" : ""} aria-current={currentCheckoutStep === 2 ? "step" : undefined}>Tus datos</li>
        </ol>

        {currentCheckoutStep === 1 ? <>
          <div className="ck-body">
            {cart.length ? (
              <>
                <ul className="ck-lines">
                  {cart.map((item) => (
                    <li className="ck-line" key={item.lineId}>
                      {item.imageUrl ? <img className="ck-line-img" src={item.imageUrl} alt="" /> : <span className="ck-line-img is-empty" aria-hidden="true"><ImageIcon size={18} /></span>}
                      <div className="ck-line-info">
                        <div className="ck-line-top"><strong>{item.productName}</strong><span>{formatMoney(item.unitPrice * item.quantity)}</span></div>
                        {item.optionLabels.length ? <p className="ck-line-meta">{item.optionLabels.join(" · ")}</p> : null}
                        <div className="ck-line-bottom">
                          <div className="ck-qty" role="group" aria-label={`Cantidad de ${item.productName}`}>
                            <button onClick={() => updateQuantity(item.lineId, -1)} aria-label={item.quantity === 1 ? `Quitar ${item.productName}` : `Restar una unidad de ${item.productName}`} type="button">{item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                            <strong>{item.quantity}</strong>
                            <button onClick={() => updateQuantity(item.lineId, 1)} aria-label={`Sumar una unidad de ${item.productName}`} type="button"><Plus size={14} /></button>
                          </div>
                          {item.quantity > 1 ? <span className="ck-unit">{formatMoney(item.unitPrice)} c/u</span> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="ck-subtotal"><span>{cartCount} {cartCount === 1 ? "producto" : "productos"}</span><span>{formatMoney(cartTotal)}</span></p>
              </>
            ) : <div className="cart-empty"><ShoppingCart size={34} aria-hidden="true" />Tu carrito está vacío.<br />Agregá productos para comenzar.</div>}
            {!store.availability.isOpen ? <p className="closed-notice">{store.availability.label}</p> : null}
            {error ? <p ref={cartErrorRef} className="form-error" role="alert">{error}</p> : null}
          </div>
          <div className="ck-foot">
            <button className="ck-cta" onClick={goToCheckoutDetails} disabled={!cart.length} type="button">Continuar · {formatMoney(cartTotal)}</button>
          </div>
        </> : <>
          <form id="order-form" className="ck-body" onSubmit={submitOrder} noValidate>
            <div className="ck-summary">
              <span className="ck-summary-imgs" aria-hidden="true">
                {cart.slice(0, 3).map((item) => item.imageUrl ? <img key={item.lineId} src={item.imageUrl} alt="" /> : <span key={item.lineId} />)}
              </span>
              <p>{cartCount} {cartCount === 1 ? "producto" : "productos"}<small>{formatMoney(cartTotal)}</small></p>
              <button onClick={() => setCheckoutStep(1)} type="button">Editar</button>
            </div>
            <div className="ck-field">
              <label htmlFor="customerName">Nombre</label>
              <input id="customerName" className="ck-input" name="customerName" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} onFocus={scrollCheckoutFieldIntoView} minLength={3} maxLength={100} autoComplete="name" placeholder="Tu nombre y apellido" required />
            </div>
            <div className="ck-field">
              <label htmlFor="customerPhone">Teléfono</label>
              <input id="customerPhone" className="ck-input" name="customerPhone" type="text" value={customerPhone} onChange={(event) => setCustomerPhone(formatArgentineLocalPhone(event.target.value))} onFocus={scrollCheckoutFieldIntoView} inputMode="numeric" maxLength={12} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="381 123-4567" required />
            </div>
            <fieldset className="ck-field">
              <legend>¿Cómo lo recibís?</legend>
              <div className="ck-options">
                <div className={`ck-option ${deliveryType === "Envío" ? "is-on" : ""}`}>
                  <label className="ck-option-row">
                    <input type="radio" name="fulfillment" value="Envío" checked={deliveryType === "Envío"} onChange={(event) => setDeliveryType(event.target.value)} required />
                    <span><strong>Envío a domicilio</strong><small>Te lo llevamos</small></span>
                    <Truck size={18} aria-hidden="true" />
                  </label>
                  {deliveryType === "Envío" ? <input id="address" className="ck-input ck-address" name="address" type="text" placeholder="Calle, número y barrio" aria-label="Dirección de entrega" onFocus={scrollCheckoutFieldIntoView} autoComplete="street-address" required /> : null}
                </div>
                <div className={`ck-option ${deliveryType === "Punto de encuentro" ? "is-on" : ""}`}>
                  <label className="ck-option-row">
                    <input type="radio" name="fulfillment" value="Punto de encuentro" checked={deliveryType === "Punto de encuentro"} onChange={(event) => setDeliveryType(event.target.value)} required />
                    <span><strong>Punto de encuentro</strong><small>Coordinamos un lugar</small></span>
                    <MapPin size={18} aria-hidden="true" />
                  </label>
                </div>
              </div>
            </fieldset>
            {!store.availability.isOpen ? <p className="closed-notice">{store.availability.label}</p> : null}
            {error ? <p ref={cartErrorRef} className="form-error" role="alert">{error}</p> : null}
          </form>
          <div className="ck-foot">
            {preview ? <p className="send-order-hint">Vista previa: los pedidos están desactivados</p> : null}
            <button className="ck-cta" form="order-form" disabled={loading || !cart.length || !store.availability.isOpen} type="submit">{loading ? "Preparando tu pedido..." : store.availability.isOpen ? `Enviar pedido · ${formatMoney(cartTotal)}` : "Tienda cerrada"}</button>
          </div>
        </>}
      </aside>

      {magicVisible ? <div className="magic-overlay show" role="status" aria-live="polite" aria-hidden="false"><span className="sparkle s1" /><span className="sparkle s2" /><span className="sparkle s3" /><span className="sparkle s4" /><span className="sparkle s5" /><div className="magic-card"><div className="magic-icon">✓</div><h3>¡Gracias por tu pedido!</h3><p>Ya lo recibimos. En un instante seguimos con la confirmación.</p><div className="magic-loading" aria-hidden="true" /></div></div> : null}

      <a className="whatsapp-float" href={publicWhatsapp} target="_blank" rel="noreferrer" aria-label="Contactar por WhatsApp"><WhatsappIcon className="h-8 w-8" /></a>
    </div>
  );
}
