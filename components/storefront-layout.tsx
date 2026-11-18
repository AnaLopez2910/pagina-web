/* eslint-disable @next/next/no-img-element */

import { ShoppingBag } from "lucide-react";
import type { FocusEventHandler, MouseEventHandler, ReactNode } from "react";

import { BowIcon, HeartIcon, SparkleIcon, SquiggleLine } from "@/components/storefront-decor";
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
  cartCount: number;
  openCart: () => void;
  selectCategory: (category: string) => void;
  whatsappUrl: string;
  renderCatalog: (copy: CatalogCopy) => ReactNode;
};

const CATEGORY_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1631214540553-ff044a3ff1d4?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=700&q=80"
];

function heroSubtitle(store: PublicStore) {
  return store.heroSubtitle ?? store.description ?? "Pestañas, maquillaje y accesorios seleccionados para vos.";
}

function categoryImage(category: PublicStore["categories"][number], index: number) {
  return category.imageUrl ?? CATEGORY_FALLBACK_IMAGES[index % CATEGORY_FALLBACK_IMAGES.length];
}

function productCountLabel(count: number | undefined) {
  if (!count) return "Próximamente";
  return `${count} ${count === 1 ? "producto" : "productos"}`;
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
  return (
    <nav className={`store-links ${className}`} aria-label="Navegación principal">
      {view.store.showCategories ? <a href="#categorias">Categorías</a> : null}
      <a href="#productos">Productos</a>
      {view.hasPromos ? <a href="#productos" onClick={() => view.selectCategory("promos")}>Promos</a> : null}
    </nav>
  );
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

function HeroDots({ view }: { view: StorefrontView }) {
  if (view.heroImages.length < 2) return null;
  return (
    <div className="hero-dots mn-dots" role="group" aria-label="Imágenes destacadas">
      {view.heroImages.map((image, index) => (
        <button
          key={`${image}-dot`}
          className={index === view.heroIndex ? "active" : ""}
          onClick={() => view.showHeroImage(index)}
          aria-label={`Ver imagen ${index + 1}`}
          aria-pressed={index === view.heroIndex}
          type="button"
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
  const words = store.categories.length ? store.categories.map((category) => category.name) : ["Pestañas", "Maquillaje", "Skincare", "Accesorios"];
  const marquee = Array.from({ length: Math.max(8, words.length) }, (_, index) => words[index % words.length]);
  const year = new Date().getFullYear();

  return (
    <>
      <header className="site-header mn-header">
        <div className="container mn-nav">
          <a href="#top" className="mn-brand" aria-label={`Inicio de ${store.name}`}>
            <BrandMark store={store} />
            <span className="mn-brand-copy"><strong>{store.name}</strong><span>beauty shop</span></span>
          </a>
          <StoreLinks view={view} className="mn-links" />
          <button className="cart-btn mn-cart" onClick={view.openCart} aria-label={`Abrir carrito, ${view.cartCount} producto(s)`} type="button">
            <ShoppingBag size={19} aria-hidden="true" />
            <span className="cart-btn-label">Mi bolsita</span>
            <span className="cart-count">{view.cartCount}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="mn-hero">
          <div className="container mn-hero-grid">
            <div className="mn-hero-copy">
              <p className="mn-script">¡Hola, linda! <HeartIcon className="mn-inline-heart" /></p>
              <h1>{store.heroTitle ?? store.name}</h1>
              <SquiggleLine className="mn-squiggle" />
              <p className="mn-hero-text">{heroSubtitle(store)}</p>
            </div>

            <div className="mn-hero-art" {...view.heroPauseHandlers}>
              <BowIcon className="mn-art-bow" />
              <div className="mn-arch"><HeroSlides view={view} /></div>
              <span className="mn-sticker-badge">
                {view.bestDiscount ? <>Hasta<strong>{view.bestDiscount}%</strong>OFF</> : <>Nuevos<strong>mimos</strong>para vos</>}
              </span>
              {store.logoUrl ? <img className="mn-sticker-logo" src={store.logoUrl} alt="" /> : null}
              <HeartIcon className="mn-float mn-float-1" />
              <HeartIcon className="mn-float mn-float-2" />
              <SparkleIcon className="mn-float mn-float-3" />
              <HeroDots view={view} />
            </div>
          </div>
        </section>

        <div className="mn-marquee" aria-hidden="true">
          <div className="mn-marquee-track">
            {[...marquee, ...marquee].map((word, index) => <span key={`${word}-${index}`}>{word} <HeartIcon /></span>)}
          </div>
        </div>

        {!store.availability.isOpen ? <div className="container"><div className="closed-notice">{store.availability.label}</div></div> : null}

        {store.showCategories ? (
          <section id="categorias" className="mn-section">
            <div className="container">
              <SectionTitle eyebrow="explorá" title="Categorías" subtitle="Encontrá rápido lo que estás buscando." centered />
              {store.categories.length ? (
                <div className="mn-cats">
                  {store.categories.map((category, index) => (
                    <button className="mn-cat" key={category.id} onClick={() => view.selectCategory(category.slug)} type="button">
                      <span className="mn-cat-ring"><img src={categoryImage(category, index)} alt="" /></span>
                      <span className="mn-cat-name">{category.name}</span>
                      <span className="mn-cat-count">{productCountLabel(view.categoryCounts[category.slug])}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="empty-state">Todavía no hay categorías para mostrar.</p>}
            </div>
          </section>
        ) : null}

        {view.renderCatalog({ eyebrow: "lo más lindo", title: "Mimos favoritos", subtitle: "Elegí lo que más te guste y armá tu pedido en minutos." })}

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
            <a href="#top" className="mn-brand" aria-label={`Volver al inicio de ${store.name}`}>
              <BrandMark store={store} />
              <span className="mn-brand-copy"><strong>{store.name}</strong><span>beauty shop</span></span>
            </a>
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
