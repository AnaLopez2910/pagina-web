"use client";
/* eslint-disable @next/next/no-img-element */

import "@/app/storefront.css";

import { ArrowLeft, ArrowUpDown, Check, ChevronLeft, ChevronRight, ImageIcon, MapPin, Maximize2, Minus, Plus, Search, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";

import { SectionTitle, StorefrontLayout, type CatalogCopy, type StorefrontView } from "@/components/storefront-layout";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { WhatsappIcon } from "@/components/whatsapp-icon";
import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import { orderProducts, SHOPPER_SORT_LABELS, SHOPPER_SORTS, type ShopperSort } from "@/lib/product-order";
import type { PublicStore, StorefrontProduct } from "@/lib/catalog-data";
import { formatMoney } from "@/lib/money";
import { formatArgentineLocalPhone, isCompleteArgentineLocalPhone, isValidCustomerName } from "@/lib/store-settings";
import { storefrontFontClasses } from "@/lib/storefront-fonts";

const FALLBACK_HERO_IMAGE = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=88";
const LOW_STOCK_THRESHOLD = 5;
const PUBLIC_PRODUCT_BATCH_SIZE = 25;

type CartItem = {
  lineId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  selectedOptionIds: string[];
  optionLabels: string[];
  unitPrice: number;
};

function calculateUnitPrice(product: StorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce((total, group) => total + group.options.reduce((sum, option) => selected.has(option.id) ? sum + option.priceDelta : sum, 0), getEffectiveProductPrice(product));
}

function optionSelectionKey(optionIds: string[]) {
  return JSON.stringify([...optionIds].sort());
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

export function PublicStore({ store, products, preview = false }: { store: PublicStore; products: StorefrontProduct[]; preview?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleProductLimit, setVisibleProductLimit] = useState(PUBLIC_PRODUCT_BATCH_SIZE);
  const [productLimitRestored, setProductLimitRestored] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const justAddedTimer = useRef<number | undefined>(undefined);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [shopperSort, setShopperSort] = useState<ShopperSort>("recommended");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const photoTouchStart = useRef<number | null>(null);
  const photoSwiped = useRef(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Zoom doubles the photo around the spot that was tapped (x/y in percent).
  const [viewerZoom, setViewerZoom] = useState<{ x: number; y: number } | null>(null);
  const viewerPointer = useRef<{ x: number; y: number } | null>(null);
  const viewerLastTap = useRef(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("Punto de encuentro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicVisible, setMagicVisible] = useState(false);
  const modalErrorRef = useRef<HTMLParagraphElement>(null);
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
  const visibleProductLimitKey = `catalog:${store.slug}:visible-products`;
  const visibleProducts = sortedProducts.slice(0, visibleProductLimit);
  const remainingProductCount = Math.max(0, sortedProducts.length - visibleProducts.length);
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // An emptied cart can't stay on the details step.
  const currentCheckoutStep = cart.length ? checkoutStep : 1;

  useLockBodyScroll(Boolean(activeProduct) || checkoutOpen || magicVisible || sortMenuOpen);

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

  useEffect(() => () => window.clearTimeout(justAddedTimer.current), []);

  useEffect(() => {
    if (heroImages.length < 2 || heroPaused) return;
    const interval = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroImages.length), 5000);
    return () => window.clearInterval(interval);
  }, [heroImages.length, heroPaused]);

  useEffect(() => {
    if (!activeProduct && !checkoutOpen && !sortMenuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      // The photo viewer sits on top of the product: Escape closes only the viewer and arrows move between photos.
      if (viewerOpen && activeProduct) {
        if (event.key === "Escape") closeViewer();
        else if (event.key === "ArrowRight") showViewerImage(activeImageIndex + 1);
        else if (event.key === "ArrowLeft") showViewerImage(activeImageIndex - 1);
        return;
      }
      if (event.key !== "Escape") return;
      setActiveProduct(null);
      setCheckoutOpen(false);
      setSortMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!activeProduct || !error) return;
    const frame = window.requestAnimationFrame(() => {
      modalErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProduct, error]);

  useEffect(() => {
    if (!checkoutOpen || activeProduct || !error) return;
    const frame = window.requestAnimationFrame(() => {
      cartErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProduct, checkoutOpen, error]);

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

  function openProduct(product: StorefrontProduct) {
    setActiveProduct(product);
    setActiveImageIndex(0);
    setViewerOpen(false);
    setViewerZoom(null);
    setSelectedOptionIds([]);
    setQuantity(1);
    setError("");
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

  function addActiveProduct() {
    if (!activeProduct || !addProductToCart(activeProduct, selectedOptionIds, quantity)) return;
    setActiveProduct(null);
    setSelectedOptionIds([]);
  }

  function changeQuantity(delta: number) {
    if (!activeProduct) return;
    const remaining = remainingStock(activeProduct);
    const max = remaining === null ? 99 : Math.max(1, remaining);
    setQuantity((current) => Math.min(max, Math.max(1, current + delta)));
  }

  function addCardProduct(product: StorefrontProduct) {
    if (product.optionGroups.length) {
      openProduct(product);
      return;
    }
    if (!addProductToCart(product, [])) return;
    setJustAddedId(product.id);
    window.clearTimeout(justAddedTimer.current);
    justAddedTimer.current = window.setTimeout(() => setJustAddedId(null), 1400);
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

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
    window.setTimeout(() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function updateProductQuery(nextQuery: string) {
    setQuery(nextQuery);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
  }

  function chooseShopperSort(nextSort: ShopperSort) {
    setShopperSort(nextSort);
    setSortMenuOpen(false);
    setVisibleProductLimit(PUBLIC_PRODUCT_BATCH_SIZE);
  }

  function openCart() {
    setCheckoutStep(1);
    setError("");
    setCheckoutOpen(true);
  }

  function showProductImage(index: number) {
    if (!activeProduct?.imageUrls.length) return;
    const count = activeProduct.imageUrls.length;
    setActiveImageIndex((index + count) % count);
  }

  function openViewer() {
    if (!activeProduct?.imageUrls.length) return;
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
    setMagicVisible(true);
    window.setTimeout(() => { window.location.href = data.whatsappUrl; }, 2100);
  }

  const publicWhatsapp = whatsappHref(store.whatsappPhone);

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
            {visibleProducts.map((product) => {
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
                    {/* The photo opens the product too; the name below is the focusable control */}
                    <button className="mn-card-photo" onClick={() => openProduct(product)} tabIndex={-1} aria-hidden="true" type="button">
                      {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt="" loading="lazy" /> : <ImageIcon size={28} aria-hidden="true" />}
                    </button>
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
                  <button className="mn-card-info" onClick={() => openProduct(product)} type="button">
                    <span className="mn-card-cat">{product.category?.name ?? "Producto"}</span>
                    <span className="mn-card-name">{product.name}</span>
                    <span className="mn-card-meta">
                      <span className="mn-price-tag">{formatMoney(getEffectiveProductPrice(product))}</span>
                      {discount ? <s>{formatMoney(product.basePrice)}</s> : null}
                      {hint ? <span className="mn-card-hint">{hint}</span> : null}
                    </span>
                  </button>
                </article>
              );
            })}
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
    renderCatalog
  };

  return (
    <div className={`public-store ${storefrontFontClasses}`}>
      <StorefrontLayout view={view} />

      {cartCount > 0 && !checkoutOpen ? <button className="cart-summary" onClick={openCart} aria-label={`Ver carrito, ${cartCount} producto(s), total ${formatMoney(cartTotal)}`} type="button"><span className="cart-summary-label"><ShoppingCart size={18} /><span>Ver carrito · {cartCount} producto(s)</span></span><strong>{formatMoney(cartTotal)}</strong></button> : null}

      {activeProduct ? (
        <div className="modal-backdrop" onClick={() => setActiveProduct(null)}>
          <div className="modal-wrap">
            <section className="mn-sheet" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}>
              <div className="mn-sheet-media">
                <div
                  className={`mn-sheet-photo ${activeProduct.imageUrls.length ? "can-expand" : ""}`}
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
                  {activeProduct.imageUrls.length ? <img src={activeProduct.imageUrls[activeImageIndex] ?? activeProduct.imageUrls[0]} alt={`${activeProduct.name}, foto ${activeImageIndex + 1}`} /> : <ImageIcon size={32} aria-hidden="true" />}
                  {activeProduct.imageUrls.length ? <button className="mn-sheet-expand" onClick={openViewer} type="button"><Maximize2 size={15} aria-hidden="true" /> Ver completa</button> : null}
                  {activeProduct.imageUrls.length > 1 ? <>
                    <button className="mn-sheet-arrow is-prev" onClick={() => showProductImage(activeImageIndex - 1)} aria-label="Foto anterior" type="button"><ChevronLeft size={20} /></button>
                    <button className="mn-sheet-arrow is-next" onClick={() => showProductImage(activeImageIndex + 1)} aria-label="Foto siguiente" type="button"><ChevronRight size={20} /></button>
                    <span className="mn-sheet-counter" aria-hidden="true">{activeImageIndex + 1} / {activeProduct.imageUrls.length}</span>
                  </> : null}
                  <button className="mn-sheet-close" onClick={() => setActiveProduct(null)} aria-label="Cerrar producto" type="button"><X size={18} /></button>
                </div>
                {activeProduct.imageUrls.length > 1 ? (
                  <div className="mn-thumbs" role="group" aria-label="Fotos del producto">
                    {activeProduct.imageUrls.map((url, index) => (
                      <button key={`${url}-${index}`} className={index === activeImageIndex ? "is-on" : ""} onClick={() => setActiveImageIndex(index)} aria-label={`Ver foto ${index + 1}`} aria-pressed={index === activeImageIndex} type="button">
                        <img src={url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mn-sheet-body">
                <div className="mn-sheet-scroll">
                  <span className="mn-sheet-cat">{activeProduct.category?.name ?? "Producto"}</span>
                  <h2 id="product-modal-title">{activeProduct.name}</h2>
                  <div className="mn-sheet-price">
                    <strong>{formatMoney(getEffectiveProductPrice(activeProduct))}</strong>
                    {getDiscountPercent(activeProduct) ? <><s>{formatMoney(activeProduct.basePrice)}</s><span className="mn-sheet-off">-{getDiscountPercent(activeProduct)}%</span></> : null}
                  </div>
                  {activeProduct.description ? <p className="mn-sheet-desc">{activeProduct.description}</p> : null}
                  {remainingStock(activeProduct) !== null ? <p className={`mn-sheet-stock ${isOutOfStock(activeProduct) ? "out" : ""}`}>{isOutOfStock(activeProduct) ? "Sin stock" : `Quedan ${remainingStock(activeProduct)}`}</p> : null}
                  {activeProduct.optionGroups.map((group) => {
                    const available = group.options.filter((option) => option.isAvailable);
                    const chosen = available.filter((option) => selectedOptionIds.includes(option.id)).map((option) => option.name).join(", ");
                    const asColors = isColorGroup(group);
                    return (
                      <fieldset className="mn-sheet-group" key={group.id}>
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
                  {error ? <p ref={modalErrorRef} className="form-error" role="alert">{error}</p> : null}
                </div>
                <div className="mn-sheet-foot">
                  {!isOutOfStock(activeProduct) ? (
                    <div className="mn-stepper" role="group" aria-label="Cantidad">
                      <button onClick={() => changeQuantity(-1)} disabled={quantity <= 1} aria-label="Restar una unidad" type="button"><Minus size={16} /></button>
                      <strong aria-live="polite">{quantity}</strong>
                      <button onClick={() => changeQuantity(1)} disabled={remainingStock(activeProduct) !== null && quantity >= (remainingStock(activeProduct) ?? 0)} aria-label="Sumar una unidad" type="button"><Plus size={16} /></button>
                    </div>
                  ) : null}
                  <button className="mn-sheet-cta" onClick={addActiveProduct} disabled={isOutOfStock(activeProduct)} type="button">{isOutOfStock(activeProduct) ? "Sin stock" : `Agregar · ${formatMoney(calculateUnitPrice(activeProduct, selectedOptionIds) * quantity)}`}</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeProduct && viewerOpen && activeProduct.imageUrls.length ? (
        <div className="mn-viewer" role="dialog" aria-modal="true" aria-label={`Fotos de ${activeProduct.name}`}>
          <div className="mn-viewer-top">
            <span className="mn-viewer-count">{activeImageIndex + 1} / {activeProduct.imageUrls.length}</span>
            <span className="mn-viewer-name">{activeProduct.name}</span>
            <button className="mn-viewer-btn" onClick={closeViewer} aria-label="Cerrar fotos" type="button" autoFocus><X size={20} /></button>
          </div>
          <div className="mn-viewer-stage" onPointerDown={startViewerGesture} onPointerUp={endViewerGesture} onPointerCancel={() => { viewerPointer.current = null; }}>
            <img
              key={activeImageIndex}
              src={activeProduct.imageUrls[activeImageIndex] ?? activeProduct.imageUrls[0]}
              alt={`${activeProduct.name}, foto ${activeImageIndex + 1}`}
              className={viewerZoom ? "is-zoomed" : ""}
              style={viewerZoom ? { transformOrigin: `${viewerZoom.x}% ${viewerZoom.y}%` } : undefined}
              draggable={false}
            />
            {activeProduct.imageUrls.length > 1 ? <>
              <button className="mn-viewer-btn mn-viewer-arrow is-prev" onPointerUp={(event) => event.stopPropagation()} onClick={() => showViewerImage(activeImageIndex - 1)} aria-label="Foto anterior" type="button"><ChevronLeft size={22} /></button>
              <button className="mn-viewer-btn mn-viewer-arrow is-next" onPointerUp={(event) => event.stopPropagation()} onClick={() => showViewerImage(activeImageIndex + 1)} aria-label="Foto siguiente" type="button"><ChevronRight size={22} /></button>
            </> : null}
          </div>
          <div className="mn-viewer-bottom">
            {activeProduct.imageUrls.length > 1 ? (
              <div className="mn-viewer-thumbs" role="group" aria-label="Elegir foto">
                {activeProduct.imageUrls.map((url, index) => (
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
