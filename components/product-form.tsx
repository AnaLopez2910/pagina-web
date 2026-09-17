"use client";

import { Check, Eye, EyeOff, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { formatMoney } from "@/lib/money";
import { optimizeProductImages } from "@/lib/product-image-compression";

type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
};

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  maxSelections: number | null;
  options: ProductOption[];
};

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  promoPrice: number | null;
  purchasePrice: number;
  imageUrls: string[];
  isVisible: boolean;
  stockQuantity: number | null;
  category: { id: string; name: string; slug: string } | null;
  optionGroups: ProductOptionGroup[];
};

type ImageDraft = {
  id: string;
  url: string;
  file?: File;
  sourceFile?: File;
};

type OptionDraft = {
  name: string;
  priceDelta: string;
  isAvailable: boolean;
};

type GroupDraft = {
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  maxSelections: string;
  options: OptionDraft[];
};

type ProductDraft = {
  name: string;
  description: string;
  basePrice: string;
  promoPrice: string;
  purchasePrice: string;
  categoryId: string;
  categoryName: string;
  images: ImageDraft[];
  isVisible: boolean;
  variantsEnabled: boolean;
  optionGroups: GroupDraft[];
  stockLimited: boolean;
  stockQuantity: string;
};

type VariantDrawerState =
  | { step: "pick" }
  | { step: "edit"; kind: "color" | "size" | "custom"; name: string; values: string[] };

const colorSuggestions = [
  { name: "Amarillo", color: "#facc15" },
  { name: "Azul", color: "#1d4ed8" },
  { name: "Beige", color: "#ede9d5" },
  { name: "Blanco", color: "#ffffff" },
  { name: "Bordó", color: "#991b1b" },
  { name: "Celeste", color: "#38bdf8" },
  { name: "Fucsia", color: "#e879f9" },
  { name: "Gris", color: "#9ca3af" },
  { name: "Marrón", color: "#92400e" },
  { name: "Naranja", color: "#f97316" },
  { name: "Negro", color: "#020617" },
  { name: "Plata", color: "#d1d5db" }
];

const sizeSuggestions = ["XS", "S", "M", "L", "XL", "XXL", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

function uniqueId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatInteger(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return Number(digits).toLocaleString("es-AR");
}

function unformatInteger(value: string) {
  return value.replace(/\D/g, "");
}

function imageDraftFromUrl(url: string): ImageDraft {
  return { id: url, url };
}

function revokeImagePreviews(images: ImageDraft[]) {
  images.forEach((image) => {
    if (image.file) {
      URL.revokeObjectURL(image.url);
    }
  });
}

function emptyDraft(categories: CategoryListItem[]): ProductDraft {
  return {
    name: "",
    description: "",
    basePrice: "",
    promoPrice: "",
    purchasePrice: "",
    categoryId: categories[0]?.id ?? "",
    categoryName: "",
    images: [],
    isVisible: true,
    variantsEnabled: false,
    optionGroups: [],
    stockLimited: false,
    stockQuantity: ""
  };
}

function productToDraft(product: ProductListItem): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? "",
    basePrice: formatInteger(product.basePrice),
    promoPrice: product.promoPrice ? formatInteger(product.promoPrice) : "",
    purchasePrice: formatInteger(product.purchasePrice),
    categoryId: product.category?.id ?? "",
    categoryName: "",
    images: product.imageUrls.map(imageDraftFromUrl),
    isVisible: product.isVisible,
    variantsEnabled: product.optionGroups.length > 0,
    optionGroups: product.optionGroups.map((group) => ({
      name: group.name,
      selectionType: group.selectionType,
      isRequired: group.isRequired,
      maxSelections: group.maxSelections ? String(group.maxSelections) : "",
      options: group.options.map((option) => ({
        name: option.name,
        priceDelta: option.priceDelta ? formatInteger(option.priceDelta) : "",
        isAvailable: option.isAvailable
      }))
    })),
    stockLimited: product.stockQuantity !== null,
    stockQuantity: product.stockQuantity === null ? "" : formatInteger(product.stockQuantity)
  };
}

function productToPayload(product: ProductListItem, overrides: Partial<ProductDraft> = {}) {
  const draft = { ...productToDraft(product), ...overrides };
  return draftToPayload(draft);
}

function draftToPayload(draft: ProductDraft) {
  return {
    name: draft.name,
    description: draft.description,
    basePrice: unformatInteger(draft.basePrice),
    promoPrice: draft.promoPrice ? unformatInteger(draft.promoPrice) : null,
    purchasePrice: unformatInteger(draft.purchasePrice),
    categoryId: draft.categoryId === "__new" ? null : draft.categoryId || null,
    categoryName: draft.categoryId === "__new" ? draft.categoryName : undefined,
    imageUrls: draft.images.filter((image) => !image.file).map((image) => image.url),
    isVisible: draft.isVisible,
    stockQuantity: draft.stockLimited ? unformatInteger(draft.stockQuantity) || "0" : null,
    optionGroups: draft.variantsEnabled
      ? draft.optionGroups
          .map((group) => ({
            name: group.name.trim(),
            selectionType: group.selectionType,
            isRequired: group.isRequired,
            maxSelections: group.maxSelections || null,
            options: group.options
              .map((option) => ({
                name: option.name.trim(),
                priceDelta: option.priceDelta ? unformatInteger(option.priceDelta) : "0",
                isAvailable: option.isAvailable
              }))
              .filter((option) => option.name)
          }))
          .filter((group) => group.name && group.options.length > 0)
      : []
  };
}

function effectivePrice(product: ProductListItem) {
  return product.promoPrice && product.promoPrice < product.basePrice ? product.promoPrice : product.basePrice;
}

function discountLabel(product: ProductListItem) {
  if (!product.promoPrice || product.promoPrice >= product.basePrice) {
    return null;
  }
  return `${Math.round((1 - product.promoPrice / product.basePrice) * 100)}% OFF`;
}

function stockLabel(product: ProductListItem) {
  if (product.stockQuantity === null) {
    return "Stock ilimitado";
  }
  if (product.stockQuantity <= 0) {
    return "Sin stock";
  }
  return `Stock: ${product.stockQuantity}`;
}

function PriceInput({
  value,
  onChange,
  placeholder,
  tone = "default",
  required = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  tone?: "default" | "promo";
  required?: boolean;
}) {
  return (
    <div className="relative">
      <span className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black ${tone === "promo" ? "text-red-600" : "text-ink"}`}>$</span>
      <input
        className={`field !pl-9 ${tone === "promo" ? "border-red-200 text-red-700" : ""}`}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(event) => onChange(formatInteger(event.target.value))}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
      <span>
        <span className="block font-black">{label}</span>
        {description ? <span className="mt-1 block text-sm font-semibold text-muted">{description}</span> : null}
      </span>
      <input className="h-5 w-5" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function ProductForm({
  products: initialProducts,
  categories: initialCategories
}: {
  products: ProductListItem[];
  categories: CategoryListItem[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState<ProductDraft>(() => emptyDraft(initialCategories));
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [variantDrawer, setVariantDrawer] = useState<VariantDrawerState | null>(null);
  const [newVariantValue, setNewVariantValue] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageOptimizing, setImageOptimizing] = useState(false);
  useLockBodyScroll(isProductModalOpen || Boolean(variantDrawer));

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = [product.name, product.description ?? "", product.category?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none" && !product.category) ||
        product.category?.id === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [categoryFilter, products, query]);

  async function refreshCategories() {
    const response = await fetch("/api/admin/categories");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setCategories(data.categories);
  }

  function replaceDraft(nextDraft: ProductDraft) {
    setDraft((current) => {
      revokeImagePreviews(current.images);
      return nextDraft;
    });
  }

  function resetDraft(nextCategories = categories) {
    setEditingProductId(null);
    replaceDraft(emptyDraft(nextCategories));
    setVariantDrawer(null);
    setNewVariantValue("");
    setError("");
  }

  function openNewProduct() {
    resetDraft();
    setProductModalOpen(true);
  }

  function openEditProduct(product: ProductListItem) {
    setEditingProductId(product.id);
    replaceDraft(productToDraft(product));
    setVariantDrawer(null);
    setNewVariantValue("");
    setError("");
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    resetDraft();
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateOption(groupIndex: number, optionIndex: number, patch: Partial<OptionDraft>) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              ...group,
              options: group.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? { ...option, ...patch } : option
              )
            }
          : group
      )
    }));
  }

  function removeGroup(index: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.filter((_, groupIndex) => groupIndex !== index)
    }));
  }

  function addOption(groupIndex: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? { ...group, options: [...group.options, { name: "", priceDelta: "", isAvailable: true }] }
          : group
      )
    }));
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? { ...group, options: group.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) }
          : group
      )
    }));
  }

  function setCover(index: number) {
    setDraft((current) => {
      const next = [...current.images];
      const [selected] = next.splice(index, 1);
      return { ...current, images: selected ? [selected, ...next] : next };
    });
  }

  function removeImage(index: number) {
    setDraft((current) => {
      const image = current.images[index];
      if (image?.file) {
        URL.revokeObjectURL(image.url);
      }
      return {
        ...current,
        images: current.images.filter((_, imageIndex) => imageIndex !== index)
      };
    });
  }

  async function addImageFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const availableSlots = 6 - draft.images.length;
    if (availableSlots <= 0) {
      setError("El máximo es 6 imágenes por producto.");
      return;
    }

    const addedImages = Array.from(files)
      .slice(0, availableSlots)
      .map((file) => ({
        id: uniqueId(),
        url: URL.createObjectURL(file),
        file,
        sourceFile: file
      }));

    setError("");
    setImageOptimizing(true);
    const candidateImages = [...draft.images, ...addedImages].slice(0, 6);
    try {
      const sources = candidateImages.filter((image) => image.file).map((image) => image.sourceFile ?? image.file as File);
      const optimized = await optimizeProductImages(sources);
      let optimizedIndex = 0;
      const nextImages = candidateImages.map((image) => {
        if (!image.file) return image;
        const file = optimized[optimizedIndex++];
        return { ...image, file, url: URL.createObjectURL(file) };
      });
      revokeImagePreviews(candidateImages);
      setDraft((current) => ({ ...current, images: nextImages }));
    } catch (compressionError) {
      addedImages.forEach((image) => URL.revokeObjectURL(image.url));
      setError(compressionError instanceof Error ? compressionError.message : "No se pudieron optimizar las imágenes.");
    } finally {
      setImageOptimizing(false);
    }
  }

  function toggleVariants(checked: boolean) {
    setDraft((current) => ({ ...current, variantsEnabled: checked, optionGroups: checked ? current.optionGroups : [] }));
  }

  function openVariantEditor(kind: "color" | "size" | "custom") {
    const name = kind === "color" ? "Color" : kind === "size" ? "Talle" : "";
    setVariantDrawer({ step: "edit", kind, name, values: [] });
    setNewVariantValue("");
  }

  function toggleVariantValue(value: string) {
    setVariantDrawer((current) => {
      if (!current || current.step !== "edit") {
        return current;
      }
      const exists = current.values.includes(value);
      return {
        ...current,
        values: exists ? current.values.filter((item) => item !== value) : [...current.values, value]
      };
    });
  }

  function addManualVariantValue() {
    const value = newVariantValue.trim();
    if (!value) {
      return;
    }
    setVariantDrawer((current) => {
      if (!current || current.step !== "edit" || current.values.includes(value)) {
        return current;
      }
      return { ...current, values: [...current.values, value] };
    });
    setNewVariantValue("");
  }

  function createVariantProperty() {
    if (!variantDrawer || variantDrawer.step !== "edit") {
      return;
    }
    const name = variantDrawer.name.trim();
    const values = variantDrawer.values.map((value) => value.trim()).filter(Boolean);
    if (!name || values.length === 0) {
      setError("Completá el nombre de la propiedad y al menos un valor.");
      return;
    }

    setDraft((current) => ({
      ...current,
      variantsEnabled: true,
      optionGroups: [
        ...current.optionGroups,
        {
          name,
          selectionType: "SINGLE",
          isRequired: true,
          maxSelections: "1",
          options: values.map((value) => ({ name: value, priceDelta: "", isAvailable: true }))
        }
      ]
    }));
    setVariantDrawer(null);
    setNewVariantValue("");
    setError("");
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (imageOptimizing) return;
    if (draft.categoryId === "__new" && !draft.categoryName.trim()) {
      setError("Ingresá el nombre de la nueva categoría.");
      return;
    }
    if (!unformatInteger(draft.basePrice)) {
      setError("Ingresá el precio base.");
      return;
    }
    if (!draft.purchasePrice.trim()) {
      setError("Ingresá el precio de compra.");
      return;
    }

    setLoading(true);
    setError("");
    const payload = draftToPayload(draft);
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    draft.images.forEach((image) => {
      if (image.file) {
        formData.append("images", image.file);
      }
    });

    let response: Response;
    try {
      response = await fetch(editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products", {
        method: editingProductId ? "PATCH" : "POST",
        body: formData
      });
    } catch {
      setLoading(false);
      setError("No se pudo conectar para guardar el producto. Intentá nuevamente.");
      return;
    }
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(response.status === 413
        ? "Las imágenes superan el tamaño permitido. Quitá una imagen o elegí archivos más livianos."
        : data?.error ?? "No se pudo guardar el producto.");
      return;
    }

    setProducts((current) =>
      editingProductId ? current.map((product) => (product.id === editingProductId ? data.product : product)) : [data.product, ...current]
    );
    await refreshCategories();
    resetDraft();
    setProductModalOpen(false);
    router.refresh();
  }

  async function toggleProductVisibility(product: ProductListItem) {
    setError("");
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productToPayload(product, { isVisible: !product.isVisible }))
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el producto.");
      return;
    }
    setProducts((current) => current.map((item) => (item.id === product.id ? data.product : item)));
    router.refresh();
  }

  async function deleteProduct(product: ProductListItem) {
    if (!window.confirm(`Eliminar ${product.name}?`)) {
      return;
    }
    setError("");
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "No se pudo eliminar el producto.");
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    await refreshCategories();
    if (editingProductId === product.id) {
      resetDraft();
      setProductModalOpen(false);
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-3 border-b border-line p-4 sm:p-5 md:grid-cols-[1fr_220px_auto]">
          <label className="grid gap-2 text-sm font-bold">
            Buscar
            <input className="field" placeholder="Producto o categoría" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Categoría
            <select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas las categorías</option>
              <option value="none">Sin categoría</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary mt-auto w-full whitespace-nowrap md:w-auto" type="button" onClick={openNewProduct}>
            <Plus size={17} /> Nuevo producto
          </button>
        </div>

        {error && !isProductModalOpen ? <p className="border-b border-line bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="divide-y divide-line">
          {filteredProducts.length === 0 ? (
            <p className="p-5 text-muted">Todavía no hay productos para mostrar.</p>
          ) : (
            filteredProducts.map((product) => {
              const label = discountLabel(product);
              return (
                <article key={product.id} className="grid gap-4 p-4 sm:p-5 md:grid-cols-[112px_1fr_auto] md:items-center">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface md:aspect-square">
                    {product.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-muted">Sin imagen</div>
                    )}
                    {label ? (
                      <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[11px] font-black text-white">
                        {label}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black leading-tight md:truncate">{product.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${product.isVisible ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {product.isVisible ? "Visible" : "Oculto"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {product.category?.name ?? "Sin categoría"} · {product.imageUrls.length} imagen(es) · {product.optionGroups.length} variante(s) · {stockLabel(product)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <strong className={label ? "text-2xl text-red-600" : "text-2xl"}>{formatMoney(effectivePrice(product))}</strong>
                      {label ? <span className="font-bold text-muted line-through">{formatMoney(product.basePrice)}</span> : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-[auto_1fr_auto] gap-2 md:flex md:flex-wrap md:justify-end">
                    <button className="btn-secondary !px-3" type="button" onClick={() => toggleProductVisibility(product)} aria-label={product.isVisible ? "Ocultar producto" : "Mostrar producto"}>
                      {product.isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                    <button className="btn-secondary !px-3" type="button" onClick={() => openEditProduct(product)}>
                      <Pencil size={17} /> Editar
                    </button>
                    <button className="btn-secondary !px-3 !text-red-600" type="button" onClick={() => deleteProduct(product)} aria-label="Eliminar producto">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {isProductModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <form onSubmit={saveProduct} className="panel grid h-[100dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden !rounded-none p-5 sm:h-auto sm:max-h-[calc(100dvh-32px)] sm:!rounded-[24px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">{editingProductId ? "Editar" : "Nuevo"}</p>
                <h2 className="text-2xl font-black">Producto</h2>
              </div>
              <button className="rounded-full border border-line p-2" type="button" disabled={imageOptimizing} onClick={closeProductModal} aria-label="Cerrar producto">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto pb-6 pr-1">
              <label className="grid gap-2 text-sm font-bold">
                Nombre
                <input className="field" placeholder="Zapatillas urbanas" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Descripción
                <textarea className="field min-h-20" placeholder="Detalle breve del producto" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold">
                  Precio base
                  <PriceInput value={draft.basePrice} onChange={(value) => updateDraft("basePrice", value)} placeholder="10.000" required />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Precio promo
                  <PriceInput value={draft.promoPrice} onChange={(value) => updateDraft("promoPrice", value)} placeholder="8.000" tone="promo" />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Precio de compra
                <PriceInput value={draft.purchasePrice} onChange={(value) => updateDraft("purchasePrice", value)} placeholder="4.000" required />
                <span className="text-xs font-semibold text-muted">Se usa para calcular costos y ganancia en gestión.</span>
              </label>

              <label className="grid gap-2 text-sm font-bold">
                Categoría
                <select className="field" value={draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__new">+ Nueva categoría</option>
                </select>
              </label>
              {draft.categoryId === "__new" ? (
                <label className="grid gap-2 text-sm font-bold">
                  Nombre de categoría
                  <input className="field" placeholder="Principales" value={draft.categoryName} onChange={(event) => updateDraft("categoryName", event.target.value)} />
                </label>
              ) : null}

              <section className="rounded-2xl border border-line p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">Imágenes</h3>
                    <p className="text-sm font-semibold text-muted">{imageOptimizing ? "Optimizando imágenes..." : "Se optimizan antes de guardar el producto."}</p>
                  </div>
                  <label className="btn-secondary !px-3">
                    <ImagePlus size={17} /> Agregar
                    <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={imageOptimizing} onChange={(event) => void addImageFiles(event.currentTarget.files)} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {draft.images.map((image, index) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-x-1 bottom-1 flex gap-1">
                        <button className="flex-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-black" type="button" disabled={imageOptimizing} onClick={() => setCover(index)}>
                          {index === 0 ? "Portada" : "Hacer portada"}
                        </button>
                        <button className="rounded-full bg-white/90 px-2 py-1 text-red-600" type="button" disabled={imageOptimizing} onClick={() => removeImage(index)} aria-label="Eliminar imagen">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {draft.images.length === 0 ? <div className="col-span-2 rounded-xl bg-surface p-4 text-center text-sm font-bold text-muted sm:col-span-3">Sin imágenes</div> : null}
                </div>
              </section>

              <Toggle
                checked={draft.variantsEnabled}
                onChange={toggleVariants}
                label="Variantes"
                description="Usá propiedades como color o talle para que el cliente elija una opción."
              />

              {draft.variantsEnabled ? (
                <section className="grid gap-3 rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Propiedades</h3>
                      <p className="text-sm font-semibold text-muted">Cada propiedad se muestra como una elección obligatoria.</p>
                    </div>
                    <button className="btn-secondary !px-3" type="button" onClick={() => setVariantDrawer({ step: "pick" })}>
                      <Plus size={16} /> Agregar
                    </button>
                  </div>

                  {draft.optionGroups.length ? (
                    <div className="grid gap-3">
                      {draft.optionGroups.map((group, groupIndex) => (
                        <article key={`${group.name}-${groupIndex}`} className="grid gap-3 rounded-2xl border border-line bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{group.name}</p>
                              <p className="text-sm font-semibold text-muted">{group.options.length} valor(es)</p>
                            </div>
                            <button className="rounded-xl border border-line px-3 py-2 text-red-600" type="button" onClick={() => removeGroup(groupIndex)} aria-label={`Eliminar ${group.name}`}>
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="grid gap-2">
                            {group.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                                <label className="grid gap-1 text-xs font-bold text-muted">
                                  Valor
                                  <input className="field !px-3 !py-2" placeholder="Rojo" value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })} />
                                </label>
                                <label className="grid gap-1 text-xs font-bold text-muted">
                                  Precio extra
                                  <PriceInput value={option.priceDelta} onChange={(value) => updateOption(groupIndex, optionIndex, { priceDelta: value })} placeholder="0" />
                                </label>
                                <button className="h-12 rounded-xl border border-line px-2 text-red-600 sm:mt-5" type="button" onClick={() => removeOption(groupIndex, optionIndex)} aria-label="Eliminar valor">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => addOption(groupIndex)}>
                            <Plus size={15} /> Agregar valor
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-surface p-3 text-sm font-bold text-muted">Activaste variantes. Agregá una propiedad como Color o Talle.</p>
                  )}
                </section>
              ) : null}

              <Toggle
                checked={draft.stockLimited}
                onChange={(checked) => updateDraft("stockLimited", checked)}
                label="Stock limitado"
                description="Si está activo, se descuenta cuando el pedido se marca como pagado."
              />
              {draft.stockLimited ? (
                <label className="grid gap-2 text-sm font-bold">
                  Stock disponible
                  <input className="field" inputMode="numeric" placeholder="10" value={draft.stockQuantity} onChange={(event) => updateDraft("stockQuantity", formatInteger(event.target.value))} />
                </label>
              ) : null}

              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={draft.isVisible} onChange={(event) => updateDraft("isVisible", event.target.checked)} /> Visible en la tienda
              </label>
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              {error ? <p className="mb-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
              <button className="btn-primary w-full" disabled={loading || imageOptimizing}>
                <Save size={18} /> {imageOptimizing ? "Optimizando imágenes..." : loading ? "Guardando..." : editingProductId ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {variantDrawer ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Agregar variante">
          <div className="grid h-[100dvh] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4">
              {variantDrawer.step === "edit" ? (
                <button className="rounded-full border border-line p-2" type="button" onClick={() => setVariantDrawer({ step: "pick" })} aria-label="Volver">
                  <X size={16} />
                </button>
              ) : (
                <button className="rounded-full border border-line p-2" type="button" onClick={() => setVariantDrawer(null)} aria-label="Cerrar variantes">
                  <X size={16} />
                </button>
              )}
              <button className="font-black text-brand" type="button" onClick={variantDrawer.step === "edit" ? createVariantProperty : undefined}>
                {variantDrawer.step === "edit" ? "Crear" : ""}
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {variantDrawer.step === "pick" ? (
                <div className="grid gap-3">
                  <div>
                    <h3 className="text-2xl font-black">Agregar propiedad</h3>
                    <p className="mt-1 text-sm font-semibold text-muted">Elegí cómo querés que el cliente seleccione la variante.</p>
                  </div>
                  <button className="rounded-2xl border border-line p-4 text-left hover:bg-surface" type="button" onClick={() => openVariantEditor("color")}>
                    <span className="block font-black">Color</span>
                    <span className="mt-1 block text-sm text-muted">Amarillo, azul, negro, blanco...</span>
                  </button>
                  <button className="rounded-2xl border border-line p-4 text-left hover:bg-surface" type="button" onClick={() => openVariantEditor("size")}>
                    <span className="block font-black">Talle</span>
                    <span className="mt-1 block text-sm text-muted">XS, S, M, 38, 39, 40...</span>
                  </button>
                  <button className="rounded-2xl border border-line p-4 text-left hover:bg-surface" type="button" onClick={() => openVariantEditor("custom")}>
                    <span className="block font-black">Personalizada</span>
                    <span className="mt-1 block text-sm text-muted">Material, sabor, presentación u otra propiedad.</span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-2xl font-black">{variantDrawer.kind === "custom" ? "Crear propiedad" : variantDrawer.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-muted">Seleccioná o cargá los valores disponibles para este producto.</p>
                  </div>

                  <label className="grid gap-2 text-sm font-bold">
                    Nombre de la propiedad
                    <input
                      className="field"
                      placeholder="Tipo de tejido"
                      value={variantDrawer.name}
                      disabled={variantDrawer.kind !== "custom"}
                      onChange={(event) => setVariantDrawer({ ...variantDrawer, name: event.target.value })}
                    />
                  </label>

                  <div className="grid gap-2">
                    <p className="text-sm font-black">Valores seleccionados</p>
                    {variantDrawer.values.length ? (
                      variantDrawer.values.map((value) => (
                        <button key={value} className="flex items-center justify-between rounded-xl border border-line p-3 text-left font-bold" type="button" onClick={() => toggleVariantValue(value)}>
                          {value}
                          <Check size={16} className="text-brand" />
                        </button>
                      ))
                    ) : (
                      <p className="rounded-xl bg-surface p-3 text-sm font-bold text-muted">Todavía no seleccionaste valores.</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <label className="grid gap-2 text-sm font-bold">
                      Agregar valor manual
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input className="field" placeholder={variantDrawer.kind === "color" ? "Azul marino" : variantDrawer.kind === "size" ? "46" : "Algodón"} value={newVariantValue} onChange={(event) => setNewVariantValue(event.target.value)} />
                        <button className="btn-secondary !px-3" type="button" onClick={addManualVariantValue}>
                          <Plus size={16} />
                        </button>
                      </div>
                    </label>
                  </div>

                  {variantDrawer.kind === "color" ? (
                    <div className="grid gap-2">
                      <p className="text-sm font-black">Colores sugeridos</p>
                      {colorSuggestions.map((suggestion) => {
                        const selected = variantDrawer.values.includes(suggestion.name);
                        return (
                          <button key={suggestion.name} className="flex items-center gap-3 border-b border-line py-3 text-left" type="button" onClick={() => toggleVariantValue(suggestion.name)}>
                            <span className={`h-5 w-5 rounded border border-line ${selected ? "ring-2 ring-brand" : ""}`} style={{ background: suggestion.color }} />
                            <span className="flex-1 font-semibold">{suggestion.name}</span>
                            {selected ? <Check size={16} className="text-brand" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {variantDrawer.kind === "size" ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black">Talles sugeridos</p>
                        <button className="text-sm font-black text-brand" type="button" onClick={() => setVariantDrawer({ ...variantDrawer, values: sizeSuggestions })}>
                          Seleccionar todos
                        </button>
                      </div>
                      {sizeSuggestions.map((suggestion) => {
                        const selected = variantDrawer.values.includes(suggestion);
                        return (
                          <button key={suggestion} className="flex items-center justify-between border-b border-line py-3 text-left font-semibold" type="button" onClick={() => toggleVariantValue(suggestion)}>
                            {suggestion}
                            {selected ? <Check size={16} className="text-brand" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="border-t border-line p-4">
              <button className="btn-primary w-full" type="button" onClick={variantDrawer.step === "edit" ? createVariantProperty : () => setVariantDrawer(null)}>
                {variantDrawer.step === "edit" ? "Crear propiedad" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
