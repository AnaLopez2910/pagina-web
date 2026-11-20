/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, Gift, ShoppingCart } from "lucide-react";
import type { FocusEventHandler, MouseEventHandler, ReactNode } from "react";

import { BowIcon, HeartIcon, SparkleIcon } from "@/components/storefront-decor";
import { WhatsappIcon } from "@/components/whatsapp-icon";
import type { PublicStore } from "@/lib/catalog-data";

export type CatalogCopy = { eyebrow: string; title: string; subtitle: string };

export type StorefrontView = {
  store: PublicStore;
  heroImages: string[];
  heroIndex: number;
  showHeroImage: (index: number) => void;
  heroPauseHandlers: {
    onMouseEnter: MouseEventHandler;
    onMouseLeave: MouseEventHandler;
    onFocus: FocusEventHandler;
    onBlur: FocusEventHandler;
  };
  hasPromos: boolean;
  bestDiscount: number | null;
  categoryCounts: Record<string, number>;
  // First product photo per category slug, used when a category has no photo of its own.
  categoryCovers: Record<string, string | null>;
  cartCount: number;
  openCart: () => void;
  selectCategory: (category: string) => void;
  whatsappUrl: string;
  // Where the catalog lives ("/" or "/demo"); links point there from other pages.
  homeHref: string;
  renderCatalog: (copy: CatalogCopy) => ReactNode;
  // Set on a product page: replaces the showcase and the catalog.
  renderPage?: () => ReactNode;
};

function heroSubtitle(store: PublicStore) {
  return store.heroSubtitle ?? store.description ?? "Pestañas, maquillaje y accesorios seleccionados para vos.";
}

// The showcase only offers categories with products. Uploading a category photo is how
// it gets picked; with no photos at all it falls back to every category with products.
function showcaseCategories(view: StorefrontView) {
  const stocked = view.store.categories.filter((category) => (view.categoryCounts[category.slug] ?? 0) > 0);
  const withPhoto = stocked.filter((category) => category.imageUrl);
  return (withPhoto.length ? withPhoto : stocked).slice(0, 4).map((category) => ({
    ...category,
    cover: category.imageUrl ?? view.categoryCovers[category.slug] ?? null
  }));
}

export function SectionTitle({ eyebrow, title, subtitle, centered = false }: { eyebrow: ReactNode; title: string; subtitle?: string; centered?: boolean }) {
  return (
    <div className={`section-title ${centered ? "centered" : ""}`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function BrandMark({ store }: { store: PublicStore }) {
  if (store.logoUrl) return <img src={store.logoUrl} alt="" className="mn-brand-mark" />;
  return <span className="mn-brand-mark brand-initial" aria-hidden="true">{store.name.slice(0, 1).toUpperCase()}</span>;
}

function StoreLinks({ view, className = "" }: { view: StorefrontView; className?: string }) {
  if (view.renderPage) {
    return (
      <nav className={`store-links ${className}`} aria-label="Navegación principal">
        {view.store.showCategories && view.store.categories.length ? <Link href={`${view.homeHref}#categorias`}>Categorías</Link> : null}
        <Link href={`${view.homeHref}#productos`}>Productos</Link>
        {view.hasPromos ? <Link href={`${view.homeHref}?categoria=promos#productos`}>Promos</Link> : null}
      </nav>
    );
  }
  return (
    <nav className={`store-links ${className}`} aria-label="Navegación principal">
      {view.store.showCategories && view.store.categories.length ? <a href="#categorias">Categorías</a> : null}
      <a href="#productos">Productos</a>
      {view.hasPromos ? <a href="#productos" onClick={() => view.selectCategory("promos")}>Promos</a> : null}
    </nav>
  );
}

function HomeLink({ view, label }: { view: StorefrontView; label: string }) {
  const content = <><BrandMark store={view.store} /><span className="mn-brand-copy"><strong>{view.store.name}</strong><span>beauty shop</span></span></>;
  return view.renderPage
    ? <Link href={view.homeHref} className="mn-brand" aria-label={label}>{content}</Link>
    : <a href="#top" className="mn-brand" aria-label={label}>{content}</a>;
}

function HeroSlides({ view }: { view: StorefrontView }) {
  return (
    <div className="slides" aria-live="polite">
      {view.heroImages.map((image, index) => (
        <img
          key={`${image}-${index}`}
          src={image}
          alt={index === view.heroIndex ? `Imagen destacada de ${view.store.name}` : ""}
          className={`slide ${index === view.heroIndex ? "active" : ""}`}
          aria-hidden={index !== view.heroIndex}
        />
      ))}
    </div>
  );
}

function WhatsappLink({ view, className, children }: { view: StorefrontView; className?: string; children: ReactNode }) {
  return <a href={view.whatsappUrl} target="_blank" rel="noreferrer" className={className}>{children}</a>;
}

export function StorefrontLayout({ view }: { view: StorefrontView }) {
  const { store } = view;
  const tiles = store.showCategories ? showcaseCategories(view) : [];
  const year = new Date().getFullYear();
  const closedNotice = store.availability.isOpen ? null : <div className="container"><div className="closed-notice">{store.availability.label}</div></div>;

  return (
    <>
      <header className="site-header mn-header">
        <div className="container mn-nav">
          <HomeLink view={view} label={`Inicio de ${store.name}`} />
          <StoreLinks view={view} className="mn-links" />
          <button className="cart-btn mn-cart" onClick={view.openCart} aria-label={`Abrir carrito, ${view.cartCount} producto(s)`} type="button">
            <ShoppingCart size={19} aria-hidden="true" />
            <span className="cart-btn-label">Carrito</span>
            <span className="cart-count">{view.cartCount}</span>
          </button>
        </div>
      </header>

      <main id="top">
        {view.renderPage ? <>
          {closedNotice}
          {view.renderPage()}
        </> : <>
          <section className="mn-vitrina">
            <div className={`container mn-vitrina-grid ${tiles.length ? "" : "no-tiles"}`}>
              <div className="mn-showcase" {...view.heroPauseHandlers}>
                <div className="mn-showcase-media"><HeroSlides view={view} /></div>
                <SparkleIcon className="mn-twinkle mn-twinkle-1" />
                <SparkleIcon className="mn-twinkle mn-twinkle-2" />
                <div className="mn-showcase-copy">
                  <h1>{store.heroTitle ?? store.name}</h1>
                  <p>{heroSubtitle(store)}</p>
                  <a className="mn-showcase-cta" href="#productos">Ver productos <ArrowRight size={18} aria-hidden="true" /></a>
                </div>
              </div>

              {tiles.length ? (
                <div id="categorias" className={`mn-cat-tiles count-${tiles.length}`}>
                  {tiles.map((category) => (
                    <button className="mn-cat-tile" key={category.id} onClick={() => view.selectCategory(category.slug)} type="button">
                      {category.cover ? <img src={category.cover} alt="" loading="lazy" /> : null}
                      <span className="mn-cat-tag">{category.name} <ArrowRight size={15} strokeWidth={2.6} aria-hidden="true" /></span>
                    </button>
                  ))}
                </div>
              ) : null}

              {view.hasPromos ? (
                <button className="mn-promo-strip" onClick={() => view.selectCategory("promos")} type="button">
                  <Gift size={24} strokeWidth={1.7} aria-hidden="true" />
                  <span className="mn-promo-bar" aria-hidden="true" />
                  <span className="mn-promo-text">Promos que enamoran <HeartIcon className="mn-promo-heart" /></span>
                  <ArrowRight size={22} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>

          {closedNotice}

          {view.renderCatalog({ eyebrow: "lo más lindo", title: "Mimos favoritos", subtitle: "Elegí lo que más te guste y armá tu pedido en minutos." })}
        </>}

        <section className="mn-section">
          <div className="container">
            <div className="mn-cta">
              <div className="mn-cta-avatar">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <BowIcon />}</div>
              <div className="mn-cta-copy">
                <h2>¿No sabés cuál elegir?</h2>
                <p>Escribinos y te ayudamos a encontrar tu match perfecto.</p>
              </div>
              <WhatsappLink view={view} className="btn btn-primary"><WhatsappIcon className="h-5 w-5" aria-hidden="true" /> Escribinos</WhatsappLink>
              <HeartIcon className="mn-cta-heart" />
            </div>
          </div>
        </section>
      </main>

      <footer className="mn-footer">
        <div className="container">
          <div className="mn-footer-grid">
            <HomeLink view={view} label={`Volver al inicio de ${store.name}`} />
            <StoreLinks view={view} className="mn-footer-links" />
          </div>
          <div className="mn-footer-bottom">
            <span>© {year} {store.name} · Hecho con <HeartIcon className="mn-footer-heart" /></span>
            <span>{store.address ? <>{store.address} · </> : null}<WhatsappLink view={view} className="mn-footer-wa">WhatsApp</WhatsappLink></span>
          </div>
        </div>
      </footer>
    </>
  );
}
