"use client";
/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, ArrowRight, ImageIcon, Minus, Plus, Search, ShoppingBag, Sparkles, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type SVGProps } from "react";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { getDiscountPercent, getEffectiveProductPrice } from "@/lib/catalog";
import type { PublicStore, StorefrontProduct } from "@/lib/catalog-data";
import { formatMoney } from "@/lib/money";
import { formatArgentineLocalPhone, isCompleteArgentineLocalPhone, isValidCustomerName } from "@/lib/store-settings";

const FALLBACK_HERO_IMAGE = "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=88";
const CATEGORY_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=700&q=80"
];
const CARD_DESCRIPTION_MAX_LENGTH = 72;

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

export function WhatsappIcon({ className = "h-6 w-6", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  );
}

function calculateUnitPrice(product: StorefrontProduct, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return product.optionGroups.reduce((total, group) => total + group.options.reduce((sum, option) => selected.has(option.id) ? sum + option.priceDelta : sum, 0), getEffectiveProductPrice(product));
}

function PriceBlock({ product, large = false, showSalePill = true }: { product: StorefrontProduct; large?: boolean; showSalePill?: boolean }) {
  const discount = getDiscountPercent(product);
  const effectivePrice = getEffectiveProductPrice(product);
  return (
    <div className="price-row">
      <span className={`price ${large ? "price-large" : ""} ${discount ? "sale-price" : ""}`}>{formatMoney(effectivePrice)}</span>
      {discount ? <span className="old-price">{formatMoney(product.basePrice)}</span> : null}
      {discount && showSalePill ? <span className="sale-pill">{discount}% OFF</span> : null}
    </div>
  );
}

function cardDescription(description: string | null) {
  const value = description?.trim() || "Belleza seleccionada para vos.";
  if (value.length <= CARD_DESCRIPTION_MAX_LENGTH) return value;
  return `${value.slice(0, CARD_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
}

function ProductImage({ product }: { product: StorefrontProduct }) {
  return (
    <div className="product-media">
      {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} /> : <div className="image-placeholder"><ImageIcon size={28} /></div>}
      {getDiscountPercent(product) ? <span className="tag sale">-{getDiscountPercent(product)}%</span> : null}
    </div>
  );
}

function whatsappHref(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return normalized ? `https://wa.me/${normalized}` : "#";
}

export function PublicStore({ store, products }: { store: PublicStore; products: StorefrontProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("Punto de encuentro");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicVisible, setMagicVisible] = useState(false);
  const modalErrorRef = useRef<HTMLParagraphElement>(null);

  const heroImages = useMemo(() => store.heroImageUrls.length ? store.heroImageUrls : [FALLBACK_HERO_IMAGE], [store.heroImageUrls]);
  const categories = store.categories;
  const hasPromos = products.some((product) => getDiscountPercent(product));
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  const filteredProducts = useMemo(() => products.filter((product) => {
    const searchableText = [product.name, product.description ?? "", product.category?.name ?? ""].join(" ").toLocaleLowerCase("es-AR");
    const matchesQuery = searchableText.includes(normalizedQuery);
    const matchesCategory = category === "all" || (category === "promos" && Boolean(getDiscountPercent(product))) || product.category?.slug === category;
    return matchesQuery && matchesCategory;
  }), [category, normalizedQuery, products]);
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const shippingThreshold = store.freeShipping.threshold;
  const shippingProgress = Math.min(100, (cartTotal / shippingThreshold) * 100);

  useLockBodyScroll(Boolean(activeProduct) || checkoutOpen || magicVisible);

  useEffect(() => {
    if (heroImages.length < 2 || heroPaused) return;
    const interval = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroImages.length), 5000);
    return () => window.clearInterval(interval);
  }, [heroImages.length, heroPaused]);

  useEffect(() => {
    if (!activeProduct && !checkoutOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setActiveProduct(null);
      setCheckoutOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeProduct, checkoutOpen]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewportHeight = () => {
      document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(viewport.height)}px`);
    };

    updateViewportHeight();
    viewport.addEventListener("resize", updateViewportHeight);
    viewport.addEventListener("scroll", updateViewportHeight);

    return () => {
      viewport.removeEventListener("resize", updateViewportHeight);
      viewport.removeEventListener("scroll", updateViewportHeight);
      document.documentElement.style.removeProperty("--visual-viewport-height");
    };
  }, []);

  useEffect(() => {
    if (!activeProduct || !error) return;

    const frame = window.requestAnimationFrame(() => {
      modalErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeProduct, error]);

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
    setSelectedOptionIds([]);
    setError("");
  }

  function addProductToCart(product: StorefrontProduct, optionIds: string[]) {
    if (isOutOfStock(product)) {
      setError("No hay stock disponible para este producto.");
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
    const optionLabels = product.optionGroups.flatMap((group) => group.options.filter((option) => optionIds.includes(option.id)).map((option) => `${group.name}: ${option.name}`));
    const lineId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCart((current) => [...current, {
      lineId,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrls[0] ?? null,
      quantity: 1,
      selectedOptionIds: optionIds,
      optionLabels,
      unitPrice: calculateUnitPrice(product, optionIds)
    }]);
    setError("");
    return true;
  }

  function addActiveProduct() {
    if (!activeProduct || !addProductToCart(activeProduct, selectedOptionIds)) return;
    setActiveProduct(null);
    setSelectedOptionIds([]);
  }

  function addCardProduct(product: StorefrontProduct) {
    if (product.optionGroups.length) {
      openProduct(product);
      return;
    }
    addProductToCart(product, []);
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
    window.setTimeout(() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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

  return (
    <div className={`public-store ${store.freeShipping.enabled ? "has-free-shipping" : ""}`}>
      {store.freeShipping.enabled ? <div className="topbar"><Truck size={15} aria-hidden="true" /> <strong>Envío gratis</strong> en compras superiores a {formatMoney(shippingThreshold)}</div> : null}

      <header>
        <div className="container nav">
          <a href="#top" className="brand" aria-label={`Inicio de ${store.name}`}>
            {store.logoUrl ? <img src={store.logoUrl} alt={store.name} className="brand-logo" /> : <div className="brand-mark">{store.name.slice(0, 1).toUpperCase()}</div>}
            <div className="brand-name">{store.name}</div>
          </a>
          <nav className="nav-links" aria-label="Navegación principal">
            {store.showCategories ? <a href="#categorias">Categorías</a> : null}
            <a href="#productos">Productos</a>
            {hasPromos ? <a href="#productos" onClick={() => selectCategory("promos")}>Promos</a> : null}
            <a href="#como-comprar">Cómo comprar</a>
          </nav>
          <div className="nav-actions">
            <button className="icon-btn cart-btn" onClick={() => setCheckoutOpen(true)} aria-label={`Abrir carrito, ${cartCount} producto(s)`} type="button"><ShoppingBag size={20} /><span className="cart-count">{cartCount}</span></button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="hero-media" onMouseEnter={() => setHeroPaused(true)} onMouseLeave={() => setHeroPaused(false)} onFocus={() => setHeroPaused(true)} onBlur={() => setHeroPaused(false)}>
              <div className="hero-slides" aria-live="polite">
                {heroImages.map((image, index) => <img key={`${image}-${index}`} src={image} alt={index === heroIndex ? `Imagen destacada de ${store.name}` : ""} className={`hero-slide ${index === heroIndex ? "active" : ""}`} aria-hidden={index !== heroIndex} />)}
              </div>
              <div className="hero-overlay">
                <div className="eyebrow"><Sparkles size={15} /> Catálogo de belleza</div>
                <h1>{store.heroTitle ?? store.name}</h1>
                <p>{store.heroSubtitle ?? store.description ?? "Pestañas, maquillaje y accesorios seleccionados para vos."}</p>
                <div className="hero-actions"><a href="#productos" className="btn btn-primary">Comprar ahora</a></div>
              </div>
              {heroImages.length > 1 ? <>
                <button className="hero-nav hero-prev" onClick={() => setHeroIndex((heroIndex - 1 + heroImages.length) % heroImages.length)} aria-label="Imagen anterior" type="button"><ArrowLeft size={18} /></button>
                <button className="hero-nav hero-next" onClick={() => setHeroIndex((heroIndex + 1) % heroImages.length)} aria-label="Imagen siguiente" type="button"><ArrowRight size={18} /></button>
                <div className="hero-dots" role="tablist" aria-label="Imágenes del hero">{heroImages.map((image, index) => <button key={`${image}-dot`} className={index === heroIndex ? "active" : ""} onClick={() => setHeroIndex(index)} aria-label={`Ver imagen ${index + 1}`} aria-selected={index === heroIndex} role="tab" type="button" />)}</div>
              </> : null}
            </div>
          </div>
        </section>

        {!store.availability.isOpen ? <div className="container"><div className="closed-notice">{store.availability.label}</div></div> : null}

        {store.showCategories ? <section id="categorias">
          <div className="container">
            <div className="section-head"><div><h2>Explorá por categoría</h2><p>Encontrá rápido lo que estás buscando.</p></div></div>
            {categories.length ? <div className="categories">{categories.map((item, index) => <button className="category-card" key={item.id} onClick={() => selectCategory(item.slug)} type="button"><img src={item.imageUrl ?? CATEGORY_FALLBACK_IMAGES[index % CATEGORY_FALLBACK_IMAGES.length]} alt={item.name} /><div className="label"><strong>{item.name}</strong><span>Explorá la colección</span></div></button>)}</div> : <p className="empty-state">Todavía no hay categorías para mostrar.</p>}
          </div>
        </section> : null}

        <section id="productos">
          <div className="container">
            <div className="section-head product-section-head"><div><h2>Favoritos del momento</h2><p>Una selección de los productos más elegidos.</p></div><div className="product-tools"><div className="store-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" /></div><div className="chips" role="group" aria-label="Filtrar productos"><button className={`chip ${category === "all" ? "active" : ""}`} aria-pressed={category === "all"} onClick={() => selectCategory("all")} type="button">Todos</button>{hasPromos ? <button className={`chip ${category === "promos" ? "active" : ""}`} aria-pressed={category === "promos"} onClick={() => selectCategory("promos")} type="button">Promos</button> : null}{categories.map((item) => <button className={`chip ${category === item.slug ? "active" : ""}`} aria-pressed={category === item.slug} key={item.id} onClick={() => selectCategory(item.slug)} type="button">{item.name}</button>)}</div></div></div>
            <div className={`product-grid mobile-cols-${store.mobileProductColumns}`}>
              {filteredProducts.map((product) => {
                const outOfStock = isOutOfStock(product);
                const remaining = remainingStock(product);
                return <article className="product" key={product.id}><button className="product-card-button" onClick={() => openProduct(product)} type="button"><ProductImage product={product} /><div className="product-body"><div className="product-sub">{product.category?.name ?? "Producto"}</div><div className="product-title">{product.name}</div><div className="product-description">{cardDescription(product.description)}</div>{remaining !== null ? <div className={`stock-label ${outOfStock ? "out" : ""}`}>{outOfStock ? "Sin stock" : `Quedan ${remaining}`}</div> : null}<PriceBlock product={product} showSalePill={false} /></div></button><div className="product-actions"><button className={`btn product-add ${outOfStock ? "disabled" : "btn-primary"}`} onClick={() => addCardProduct(product)} disabled={outOfStock} type="button">{outOfStock ? "Sin stock" : product.optionGroups.length ? "Elegir opciones" : "Agregar al carrito"}</button></div></article>;
              })}
            </div>
            {!filteredProducts.length ? <div className="empty-state">No encontramos productos con esos filtros.</div> : null}

            {store.freeShipping.enabled ? <div className="shipping-progress"><div className="shipping-progress-top"><strong>{cartTotal >= shippingThreshold ? "¡Tu pedido tiene envío gratis!" : `Te faltan ${formatMoney(Math.max(0, shippingThreshold - cartTotal))} para tener envío gratis`}</strong><span>Meta: {formatMoney(shippingThreshold)}</span></div><div className="progress" aria-label={`${Math.round(shippingProgress)}% del objetivo de envío gratis`}><div style={{ width: `${shippingProgress}%` }} /></div></div> : null}
          </div>
        </section>

        <section id="como-comprar"><div className="container"><div className="section-head"><div><h2>Comprar es simple</h2><p>Sin registros y sin vueltas.</p></div></div><div className="how"><div className="how-card"><div className="step">1</div><h3>Elegí tus productos</h3><p>Explorá el catálogo, categorías y promociones disponibles.</p></div><div className="how-card"><div className="step">2</div><h3>Armá tu carrito</h3><p>Agregá uno o varios productos y revisá tu pedido antes de enviarlo.</p></div><div className="how-card"><div className="step">3</div><h3>Coordiná entrega y pago</h3><p>Completá tus datos y enviá el pedido por WhatsApp para confirmar stock, pago y entrega.</p></div></div></div></section>

        <section><div className="container"><div className="cta"><h2>¿No sabés cuál elegir?</h2><p>Escribinos y te ayudamos a encontrar el producto ideal según lo que buscás.</p><a href={publicWhatsapp} target="_blank" rel="noreferrer" className="btn btn-primary"><WhatsappIcon className="h-5 w-5" /> Hablar por WhatsApp</a></div></div></section>
      </main>

      <footer><div className="container footer-grid"><div>© {new Date().getFullYear()} {store.name} · Catálogo online</div><div>{store.address ? `${store.address} · ` : ""}<a href={publicWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a> · Envíos</div></div></footer>

      {cartCount > 0 && !checkoutOpen ? <button className="cart-summary" onClick={() => setCheckoutOpen(true)} aria-label={`Ver carrito, ${cartCount} producto(s), total ${formatMoney(cartTotal)}`} type="button"><span className="cart-summary-label"><ShoppingBag size={18} /><span>Ver carrito · {cartCount} producto(s)</span></span><strong>{formatMoney(cartTotal)}</strong></button> : null}

      {activeProduct ? <div className="modal-backdrop" onClick={() => setActiveProduct(null)}><div className="modal-wrap"><section className={`product-modal ${activeProduct.imageUrls.length ? "has-gallery" : "no-gallery"}`} role="dialog" aria-modal="true" aria-labelledby="product-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close modal-close-floating" onClick={() => setActiveProduct(null)} aria-label="Cerrar producto" type="button"><X size={19} /></button><div className="modal-body-scroll">{activeProduct.imageUrls.length ? <div className="modal-gallery"><div className="modal-main-image"><img src={activeProduct.imageUrls[activeImageIndex] ?? activeProduct.imageUrls[0]} alt={`${activeProduct.name}, imagen ${activeImageIndex + 1}`} /></div>{activeProduct.imageUrls.length > 1 ? <div className="modal-thumbs" role="group" aria-label="Imágenes del producto">{activeProduct.imageUrls.map((url, index) => <button className={index === activeImageIndex ? "active" : ""} aria-label={`Ver imagen ${index + 1}`} aria-current={index === activeImageIndex ? "true" : undefined} key={`${url}-${index}`} onClick={() => setActiveImageIndex(index)} type="button"><img src={url} alt="" /></button>)}</div> : null}</div> : null}<div className="modal-content"><div className="modal-content-scroll"><div className="modal-heading"><div><p className="product-sub">{activeProduct.category?.name ?? "Producto"}</p><h2 id="product-modal-title">{activeProduct.name}</h2><p className="modal-description">{activeProduct.description ?? "Belleza seleccionada para vos."}</p><PriceBlock product={activeProduct} large /></div></div>{remainingStock(activeProduct) !== null ? <p className={`stock-label ${isOutOfStock(activeProduct) ? "out" : ""}`}>{isOutOfStock(activeProduct) ? "Sin stock disponible" : `Quedan ${remainingStock(activeProduct)}`}</p> : null}<div className="options-list">{activeProduct.optionGroups.map((group) => <fieldset key={group.id}><legend>{group.name} {group.isRequired ? <span>*</span> : null}</legend>{group.options.filter((option) => option.isAvailable).map((option) => <label key={option.id}><span><input type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={selectedOptionIds.includes(option.id)} onChange={() => toggleOption(group, option.id)} /> {option.name}</span>{option.priceDelta ? <strong>+{formatMoney(option.priceDelta)}</strong> : null}</label>)}</fieldset>)}</div>{error ? <p ref={modalErrorRef} className="form-error" role="alert">{error}</p> : null}</div></div></div><div className="modal-actions"><button className="btn btn-primary full-button" onClick={addActiveProduct} disabled={isOutOfStock(activeProduct)} type="button">{isOutOfStock(activeProduct) ? "Sin stock" : `Agregar · ${formatMoney(calculateUnitPrice(activeProduct, selectedOptionIds))}`}</button></div></section></div></div> : null}

      <><div className={"cart-backdrop " + (checkoutOpen ? "open" : "")} onClick={() => setCheckoutOpen(false)} aria-hidden={!checkoutOpen} /><aside className={"cart-drawer " + (checkoutOpen ? "open" : "")} role="dialog" aria-modal="true" aria-label="Carrito" aria-hidden={!checkoutOpen}><div className="cart-head"><div className="cart-head-copy"><h3>Tu pedido</h3><span>{cartCount} {cartCount === 1 ? "producto" : "productos"}</span></div><button className="close-btn" onClick={() => setCheckoutOpen(false)} aria-label="Cerrar carrito" type="button"><X /></button></div><div className="cart-content">{cart.length ? <div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.lineId}>{item.imageUrl ? <img className="cart-item-image" src={item.imageUrl} alt="" /> : <div className="cart-item-image cart-item-image-placeholder" aria-hidden="true"><ImageIcon size={18} /></div>}<div><div className="cart-item-title">{item.productName}</div><div className="cart-item-price">{item.optionLabels.join(" · ") || formatMoney(item.unitPrice) + " c/u"}</div></div><div className="qty"><button onClick={() => updateQuantity(item.lineId, -1)} aria-label={"Quitar una unidad de " + item.productName} type="button"><Minus size={15} /></button><strong>{item.quantity}</strong><button onClick={() => updateQuantity(item.lineId, 1)} aria-label={"Agregar una unidad de " + item.productName} type="button"><Plus size={15} /></button></div></article>)}</div> : <div className="cart-empty">Tu carrito está vacío.<br />Agregá productos para comenzar.</div>}<div className="checkout-card"><form id="order-form" className="order-form" onSubmit={submitOrder} noValidate><div className="field"><label htmlFor="customerName">Nombre completo</label><input id="customerName" placeholder="Ana Lopez" className="store-field" name="customerName" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} minLength={3} maxLength={100} autoComplete="name" required /></div><div className="field"><label htmlFor="customerPhone">Teléfono</label><input id="customerPhone" className="store-field" name="customerPhone" type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(formatArgentineLocalPhone(event.target.value))} inputMode="tel" maxLength={12} autoComplete="tel" placeholder="381 123-4567" required /></div><div className="field"><span className="field-label">Medio de entrega</span><div className="delivery-options"><label className={"delivery-option " + (deliveryType === "Envío" ? "selected" : "")}><input type="radio" name="fulfillment" value="Envío" checked={deliveryType === "Envío"} onChange={(event) => setDeliveryType(event.target.value)} required /><span><strong>Envío</strong><small>Recibilo en tu domicilio</small></span></label><label className={"delivery-option " + (deliveryType === "Punto de encuentro" ? "selected" : "")}><input type="radio" name="fulfillment" value="Punto de encuentro" checked={deliveryType === "Punto de encuentro"} onChange={(event) => setDeliveryType(event.target.value)} required /><span><strong>Punto de encuentro</strong><small>Coordinamos un lugar</small></span></label></div></div>{deliveryType === "Envío" ? <div className="field"><label htmlFor="address">Dirección de entrega</label><input id="address" className="store-field" name="address" type="text" placeholder="Calle, número, barrio / localidad" required /></div> : null}{!store.availability.isOpen ? <p className="closed-notice">{store.availability.label}</p> : null}{error ? <p className="form-error">{error}</p> : null}</form></div></div><div className="cart-footer"><div className="cart-total"><span>Total estimado</span><span>{formatMoney(cartTotal)}</span></div><p className="send-order-hint">Se abrirá WhatsApp para coordinar los detalles</p><button className="btn send-order" form="order-form" disabled={loading || !cart.length || !store.availability.isOpen} type="submit"><WhatsappIcon className="h-5 w-5" /> {loading ? "Preparando tu pedido..." : store.availability.isOpen ? "Confirmar pedido por WhatsApp" : "Tienda cerrada"}</button></div></aside></>

      {magicVisible ? <div className="magic-overlay show" role="status" aria-live="polite" aria-hidden="false"><span className="sparkle s1" /><span className="sparkle s2" /><span className="sparkle s3" /><span className="sparkle s4" /><span className="sparkle s5" /><div className="magic-card"><div className="magic-icon">✓</div><h3>¡Gracias por tu pedido!</h3><p>Ya tenemos todo listo. En un instante te llevamos a WhatsApp para confirmar los últimos detalles.</p><div className="magic-loading" aria-hidden="true" /></div></div> : null}

      <a className="whatsapp-float" href={publicWhatsapp} target="_blank" rel="noreferrer" aria-label="Contactar por WhatsApp"><WhatsappIcon className="h-8 w-8" /></a>
    </div>
  );
}
