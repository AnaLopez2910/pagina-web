import type { PublicStore, StorefrontProduct } from "@/lib/catalog-data";

// Sample catalog used only by /demo to preview the storefront without a Supabase project.

function unsplash(id: string, width = 900) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;
}

const categories = [
  { id: "demo-cat-pestanas", name: "Pestañas", slug: "pestanas", imageUrl: unsplash("1631214540553-ff044a3ff1d4", 600) },
  { id: "demo-cat-maquillaje", name: "Maquillaje", slug: "maquillaje", imageUrl: unsplash("1512496015851-a90fb38ba796", 600) },
  { id: "demo-cat-skincare", name: "Skincare", slug: "skincare", imageUrl: unsplash("1598440947619-2c35fc9aa908", 600) },
  { id: "demo-cat-accesorios", name: "Accesorios", slug: "accesorios", imageUrl: unsplash("1607779097040-26e80aa78e66", 600) }
];

function category(slug: string) {
  const match = categories.find((item) => item.slug === slug);
  return match ? { id: match.id, name: match.name, slug: match.slug } : null;
}

function product(input: Omit<StorefrontProduct, "slug" | "stockQuantity" | "promoPrice" | "optionGroups"> & Partial<Pick<StorefrontProduct, "stockQuantity" | "promoPrice" | "optionGroups">>): StorefrontProduct {
  return {
    slug: input.id,
    stockQuantity: null,
    promoPrice: null,
    optionGroups: [],
    ...input
  };
}

export const demoProducts: StorefrontProduct[] = [
  product({
    id: "demo-mascara",
    name: "Máscara Volumen Lift",
    description: "Pestañas más largas y curvadas desde la primera pasada, sin grumos.",
    basePrice: 8900,
    promoPrice: 6900,
    imageUrls: [unsplash("1631214540553-ff044a3ff1d4")],
    category: category("pestanas"),
    optionGroups: [{
      id: "demo-mascara-color",
      name: "Color",
      selectionType: "SINGLE",
      isRequired: true,
      maxSelections: 1,
      options: [
        { id: "demo-mascara-negro", name: "Negro intenso", priceDelta: 0, isAvailable: true, colorHex: "#1f1a1d" },
        { id: "demo-mascara-marron", name: "Marrón", priceDelta: 0, isAvailable: true, colorHex: "#6b4331" }
      ]
    }]
  }),
  product({
    id: "demo-pestanas-naturales",
    name: "Pestañas Efecto Natural",
    description: "Volumen delicado para una mirada luminosa todos los días.",
    basePrice: 8500,
    promoPrice: 6900,
    imageUrls: [unsplash("1487412947147-5cebf100ffc2")],
    category: category("pestanas")
  }),
  product({
    id: "demo-paleta",
    name: "Paleta Nude Glow",
    description: "Doce tonos mate y satinados para looks de día y de noche.",
    basePrice: 18500,
    imageUrls: [unsplash("1522335789203-aabd1fc54bc9")],
    category: category("maquillaje")
  }),
  product({
    id: "demo-labial",
    name: "Labial Cremoso Rosé",
    description: "Color intenso con acabado satinado y fórmula hidratante.",
    basePrice: 7200,
    imageUrls: [unsplash("1625093742435-6fa192b6fb10")],
    category: category("maquillaje"),
    optionGroups: [{
      id: "demo-labial-tono",
      name: "Tono",
      selectionType: "SINGLE",
      isRequired: true,
      maxSelections: 1,
      options: [
        { id: "demo-labial-nude", name: "Nude", priceDelta: 0, isAvailable: true, colorHex: "#d8a28c" },
        { id: "demo-labial-rose", name: "Rosé", priceDelta: 0, isAvailable: true, colorHex: "#cf7a8a" },
        { id: "demo-labial-cereza", name: "Cereza", priceDelta: 0, isAvailable: true, colorHex: "#a3122f" }
      ]
    }]
  }),
  product({
    id: "demo-rubor",
    name: "Rubor Compacto Peach",
    description: "Un toque de color natural que se funde con la piel.",
    basePrice: 6400,
    promoPrice: 5400,
    imageUrls: [unsplash("1503236823255-94609f598e71")],
    category: category("maquillaje")
  }),
  product({
    id: "demo-brochas",
    name: "Set de Brochas x10",
    description: "Cerdas suaves para base, polvo, rubor y sombras.",
    basePrice: 14900,
    stockQuantity: 3,
    imageUrls: [unsplash("1526045478516-99145907023c")],
    category: category("accesorios")
  }),
  product({
    id: "demo-serum",
    name: "Sérum Glow Vitamina C",
    description: "Ilumina, unifica el tono y deja la piel lista para el maquillaje.",
    basePrice: 12900,
    imageUrls: [unsplash("1576426863848-c21f53c60b19")],
    category: category("skincare")
  }),
  product({
    id: "demo-aceite",
    name: "Aceite Facial Botánico",
    description: "Nutrición profunda con aceites vegetales livianos.",
    basePrice: 11500,
    stockQuantity: 0,
    imageUrls: [unsplash("1617897903246-719242758050")],
    category: category("skincare")
  }),
  product({
    id: "demo-kit",
    name: "Kit Maquillaje Esencial",
    description: "Todo lo que necesitás para un look completo en un solo kit.",
    basePrice: 24900,
    promoPrice: 19900,
    imageUrls: [unsplash("1596462502278-27bfdc403348")],
    category: category("maquillaje")
  }),
  product({
    id: "demo-esmaltes",
    name: "Esmaltes Pastel x3",
    description: "Tonos suaves de secado rápido y brillo duradero.",
    basePrice: 5900,
    imageUrls: [unsplash("1607779097040-26e80aa78e66")],
    category: category("accesorios")
  }),
  product({
    id: "demo-crema",
    name: "Crema Corporal Suave",
    description: "Textura liviana que hidrata sin dejar sensación grasa.",
    basePrice: 8200,
    imageUrls: [unsplash("1620916566398-39f1143ab7be")],
    category: category("skincare")
  }),
  product({
    id: "demo-polvo",
    name: "Polvo Traslúcido Matte",
    description: "Sella el maquillaje y controla el brillo todo el día.",
    basePrice: 7800,
    imageUrls: [unsplash("1515688594390-b649af70d282")],
    category: category("maquillaje")
  })
];

export const demoStore: PublicStore = {
  name: "Amo Store",
  slug: "demo",
  description: "Pestañas, maquillaje y accesorios para tus rituales de belleza.",
  whatsappPhone: "541100000000",
  address: "Zona de retiro a coordinar",
  heroTitle: "Pestañas, maquillaje y accesorios que vas a amar",
  heroSubtitle: "Elegí tus favoritos y recibilos en tu casa o en un punto de encuentro",
  heroImageUrls: [
    unsplash("1487412947147-5cebf100ffc2", 1600),
    unsplash("1596462502278-27bfdc403348", 1600),
    unsplash("1631214540553-ff044a3ff1d4", 1600)
  ],
  logoUrl: "/amo-store-logo.jpg",
  categories,
  showCategories: true,
  mobileProductColumns: 2,
  freeShipping: { enabled: true, threshold: 35000 },
  availability: { isOpen: true, label: "Tienda abierta" }
};
