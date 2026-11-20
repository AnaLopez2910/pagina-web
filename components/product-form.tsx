"use client";

import { ArrowDownToLine, ArrowUpDown, ArrowUpToLine, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, GripVertical, ImagePlus, MoreHorizontal, Pencil, Plus, Save, Search, SlidersHorizontal, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { formatMoney } from "@/lib/money";
import { orderProducts, PRODUCT_SORT_LABELS, PRODUCT_SORTS, type ProductSort } from "@/lib/product-order";
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
  colorHex: string | null;
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
  sortOrder: number;
  createdAt: string;
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
  colorHex: string;
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

type PriceStockDraft = { basePrice: string; promoPrice: string; stockLimited: boolean; stockQuantity: string };

const PRODUCT_PAGE_SIZE = 25;

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
        isAvailable: option.isAvailable,
        colorHex: option.colorHex ?? ""
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
                isAvailable: option.isAvailable,
                colorHex: option.colorHex || null
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

// Optional swatch colour for a variant value; empty means the storefront shows the name only.
function OptionColorPicker({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  return (
    <div className="grid w-[76px] gap-1 text-xs font-bold text-muted">
      Color
      <div className="flex h-12 items-center gap-1">
        <label
          className={`relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full ${value ? "border-2 border-white shadow-[0_0_0_1px_#ecd5e2]" : "border-2 border-dashed border-line text-muted"}`}
          style={value ? { background: value } : undefined}
          title={value ? "Cambiar color" : "Agregar color"}
        >
          {value ? null : <Plus size={14} />}
          <input
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="color"
            value={value || "#e8a0b4"}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`Color de ${label || "este valor"}`}
          />
        </label>
        {value ? (
          <button className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface" type="button" onClick={() => onChange("")} aria-label={`Quitar color de ${label || "este valor"}`}>
            <X size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
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

type ManualOrderTarget = "start" | "end" | { beforeId: string } | { afterId: string };

export function ProductForm({
  products: initialProducts,
  categories: initialCategories,
  productSort: initialProductSort,
  soldOutLast: initialSoldOutLast
}: {
  products: ProductListItem[];
  categories: CategoryListItem[];
  productSort: ProductSort;
  soldOutLast: boolean;
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
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [promoFilter, setPromoFilter] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedVariantProducts, setExpandedVariantProducts] = useState<string[]>([]);
  const [actionsProduct, setActionsProduct] = useState<ProductListItem | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkCategoryName, setBulkCategoryName] = useState("");
  const [priceStockProduct, setPriceStockProduct] = useState<ProductListItem | null>(null);
  const [priceStockDraft, setPriceStockDraft] = useState<PriceStockDraft>({ basePrice: "", promoPrice: "", stockLimited: false, stockQuantity: "" });
  const [priceStockBusy, setPriceStockBusy] = useState(false);
  const [quickUpdateProductId, setQuickUpdateProductId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageOptimizing, setImageOptimizing] = useState(false);
  const [productSort, setProductSort] = useState(initialProductSort);
  const [soldOutLast, setSoldOutLast] = useState(initialSoldOutLast);
  const [sortMenuPosition, setSortMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [dragState, setDragState] = useState<{ id: string; from: number; over: number } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const bulkCategoryRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const menuFirstActionRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useLockBodyScroll(isProductModalOpen || Boolean(variantDrawer) || filterModalOpen || Boolean(priceStockProduct) || Boolean(sortMenuPosition) || bulkDeleteOpen);

  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories]);
  // The list mirrors the storefront order. "Aleatorio" shuffles per visit, so here it shows the manual order.
  const orderedProducts = useMemo(
    () => orderProducts(products, productSort === "random" ? "manual" : productSort, { soldOutLast, categoryIds }),
    [categoryIds, productSort, products, soldOutLast]
  );

  const filteredProducts = useMemo(() => {
    return orderedProducts.filter((product) => {
      const matchesQuery = [product.name, product.description ?? "", product.category?.name ?? ""]
        .join(" ")
        .toLocaleLowerCase("es-AR")
        .includes(query.trim().toLocaleLowerCase("es-AR"));
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "none" && !product.category) ||
        product.category?.id === categoryFilter;
      const matchesLowStock = !lowStockFilter || (product.stockQuantity !== null && product.stockQuantity < 5);
      const matchesPromo = !promoFilter || Boolean(discountLabel(product));
      const matchesVisibility = visibilityFilter === "all" || product.isVisible === (visibilityFilter === "visible");
      return matchesQuery && matchesCategory && matchesLowStock && matchesPromo && matchesVisibility;
    });
  }, [categoryFilter, lowStockFilter, orderedProducts, promoFilter, query, visibilityFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = filteredProducts.slice((currentPage - 1) * PRODUCT_PAGE_SIZE, currentPage * PRODUCT_PAGE_SIZE);
  const activeFilterCount = [categoryFilter !== "all", lowStockFilter, promoFilter, visibilityFilter !== "all"].filter(Boolean).length;
  const selectedFilteredCount = filteredProducts.filter((product) => selectedProductIds.has(product.id)).length;
  const selectedProducts = products.filter((product) => selectedProductIds.has(product.id));
  const allFilteredSelected = filteredProducts.length > 0 && selectedFilteredCount === filteredProducts.length;
  const manualOrder = productSort === "manual";
  // Dragging only makes sense over the whole list, so search and filters pause it.
  const canDrag = manualOrder && !query.trim() && activeFilterCount === 0;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedFilteredCount > 0 && !allFilteredSelected;
  }, [allFilteredSelected, selectedFilteredCount]);

  useEffect(() => {
    if (actionsProduct) menuFirstActionRef.current?.focus();
  }, [actionsProduct]);

  useEffect(() => {
    if (!filterModalOpen && !actionsProduct && !priceStockProduct && !sortMenuPosition && !bulkDeleteOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFilterModalOpen(false);
        if (actionsProduct) closeProductMenu();
        setPriceStockProduct(null);
        setSortMenuPosition(null);
        if (!bulkBusy) setBulkDeleteOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [actionsProduct, bulkBusy, bulkDeleteOpen, filterModalOpen, priceStockProduct, sortMenuPosition]);

  useEffect(() => {
    if (!sortMenuPosition) return;
    function closeSortMenu() { setSortMenuPosition(null); }
    window.addEventListener("resize", closeSortMenu);
    return () => window.removeEventListener("resize", closeSortMenu);
  }, [sortMenuPosition]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (!actionsProduct) return;
    function closeMenu() { closeProductMenu(false); }
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [actionsProduct]);

  async function refreshCategories() {
    const response = await fetch("/api/admin/categories");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setCategories(data.categories);
  }

  function clearSelection() {
    setSelectedProductIds(new Set());
    setBulkCategoryOpen(false);
    setBulkCategoryId("");
    setBulkCategoryName("");
  }

  function clearProductFilters() {
    setCategoryFilter("all");
    setLowStockFilter(false);
    setPromoFilter(false);
    setVisibilityFilter("all");
    setPage(1);
    clearSelection();
  }

  function toggleAllFilteredProducts() {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredProducts.forEach((product) => next.delete(product.id));
      else filteredProducts.forEach((product) => next.add(product.id));
      return next;
    });
  }

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function closeProductMenu(restoreFocus = true) {
    setActionsProduct(null);
    if (restoreFocus) window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }

  function openProductMenu(event: React.MouseEvent<HTMLButtonElement>, product: ProductListItem) {
    menuTriggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = Math.min(272, window.innerWidth - 24);
    const menuHeight = manualOrder ? 356 : 260;
    let top = rect.bottom + 8;
    if (top + menuHeight > window.innerHeight - 12) top = rect.top - menuHeight - 8;
    top = Math.max(12, Math.min(top, window.innerHeight - menuHeight - 12));
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    setActionsMenuPosition({ top, left });
    setActionsProduct(product);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3200);
  }

  function openSortMenu(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 340;
    const menuHeight = 520;
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12));
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    setError("");
    setSortMenuPosition({ top, left });
  }

  async function saveSortSettings(next: { productSort: ProductSort; soldOutLast: boolean }) {
    const previous = { productSort, soldOutLast };
    setProductSort(next.productSort);
    setSoldOutLast(next.soldOutLast);
    setOrderBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setProductSort(previous.productSort);
        setSoldOutLast(previous.soldOutLast);
        setError(data?.error ?? "No se pudo guardar el orden.");
        return;
      }
      setPage(1);
      router.refresh();
    } catch {
      setProductSort(previous.productSort);
      setSoldOutLast(previous.soldOutLast);
      setError("No se pudo conectar para guardar el orden.");
    } finally {
      setOrderBusy(false);
    }
  }

  async function saveManualOrder(productIds: string[]) {
    const previousProducts = products;
    const positions = new Map(productIds.map((id, index) => [id, index]));
    setProducts((current) => current.map((product) => ({ ...product, sortOrder: positions.get(product.id) ?? product.sortOrder })));
    setOrderBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setProducts(previousProducts);
        setError(data?.error ?? "No se pudo guardar el orden.");
        return;
      }
      router.refresh();
    } catch {
      setProducts(previousProducts);
      setError("No se pudo conectar para guardar el orden.");
    } finally {
      setOrderBusy(false);
    }
  }

  function moveProduct(productId: string, target: ManualOrderTarget) {
    const ids = orderProducts(products, "manual", { soldOutLast: false }).map((product) => product.id).filter((id) => id !== productId);
    let index = ids.length;
    if (target === "start") index = 0;
    else if (typeof target === "object" && "beforeId" in target) index = ids.indexOf(target.beforeId);
    else if (typeof target === "object") index = ids.indexOf(target.afterId) + 1;
    ids.splice(index < 0 ? ids.length : index, 0, productId);
    void saveManualOrder(ids);
  }

  function dropIndexAt(clientY: number) {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-product-row]") ?? []);
    const index = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return index === -1 ? rows.length : index;
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, productId: string, index: number) {
    if (!canDrag || orderBusy || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ id: productId, from: index, over: index });
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragState) return;
    // Scroll while dragging near the edges so a product can travel the whole page.
    if (event.clientY < 90) window.scrollBy(0, -14);
    else if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
    const over = dropIndexAt(event.clientY);
    if (over !== dragState.over) setDragState({ ...dragState, over });
  }

  function endDrag() {
    if (!dragState) return;
    const { id, from, over } = dragState;
    setDragState(null);
    if (over === from || over === from + 1) return;
    moveProduct(id, over >= pageProducts.length ? { afterId: pageProducts[pageProducts.length - 1].id } : { beforeId: pageProducts[over].id });
  }

  function openBulkCategoryPicker() {
    setBulkCategoryOpen(true);
    setBulkCategoryId("");
    setBulkCategoryName("");
    window.requestAnimationFrame(() => bulkCategoryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function deleteSelectedProducts() {
    const productIds = Array.from(selectedProductIds);
    if (!productIds.length) return;
    setBulkBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "No se pudieron eliminar los productos seleccionados.");
        return;
      }
      const deletedIds = new Set<string>(data?.deletedIds ?? productIds);
      setProducts((current) => current.filter((product) => !deletedIds.has(product.id)));
      if (editingProductId && deletedIds.has(editingProductId)) {
        resetDraft();
        setProductModalOpen(false);
      }
      setBulkDeleteOpen(false);
      clearSelection();
      setPage(1);
      showNotice(deletedIds.size === 1 ? "Se eliminó 1 producto" : `Se eliminaron ${deletedIds.size} productos`);
      await refreshCategories();
      router.refresh();
    } catch {
      setError("No se pudo conectar para eliminar los productos seleccionados.");
    } finally {
      setBulkBusy(false);
    }
  }

  function hideSelectedInstead() {
    setBulkDeleteOpen(false);
    void applyBulkUpdate({ action: "visibility", isVisible: false });
  }

  function openDuplicateProduct(product: ProductListItem) {
    setActionsProduct(null);
    setEditingProductId(null);
    const copySuffix = " (copia)";
    const copyName = `${product.name.slice(0, 120 - copySuffix.length).trimEnd()}${copySuffix}`;
    replaceDraft(productToDraft(product));
    setDraft((current) => ({ ...current, name: copyName }));
    setVariantDrawer(null);
    setNewVariantValue("");
    setError("");
    setProductModalOpen(true);
  }

  function openPriceStockEditor(product: ProductListItem) {
    setActionsProduct(null);
    setError("");
    setPriceStockProduct(product);
    setPriceStockDraft({
      basePrice: formatInteger(product.basePrice),
      promoPrice: product.promoPrice ? formatInteger(product.promoPrice) : "",
      stockLimited: product.stockQuantity !== null,
      stockQuantity: product.stockQuantity === null ? "" : formatInteger(product.stockQuantity)
    });
  }

  async function savePriceStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceStockProduct) return;
    if (!unformatInteger(priceStockDraft.basePrice)) {
      setError("Ingresá un precio base mayor a cero.");
      return;
    }

    setPriceStockBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${priceStockProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "price-stock",
          basePrice: unformatInteger(priceStockDraft.basePrice),
          promoPrice: priceStockDraft.promoPrice ? unformatInteger(priceStockDraft.promoPrice) : null,
          stockQuantity: priceStockDraft.stockLimited ? unformatInteger(priceStockDraft.stockQuantity) || "0" : null
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "No se pudo actualizar el precio y el stock.");
        return;
      }
      setProducts((current) => current.map((product) => product.id === priceStockProduct.id ? data.product : product));
      setPriceStockProduct(null);
      router.refresh();
    } catch {
      setError("No se pudo conectar para actualizar el precio y el stock.");
    } finally {
      setPriceStockBusy(false);
    }
  }

  async function applyBulkUpdate(change: { action: "visibility"; isVisible: boolean } | { action: "category"; categoryId: string | null; categoryName?: string }) {
    const productIds = Array.from(selectedProductIds);
    if (!productIds.length) return;
    setBulkBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...change, productIds })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "No se pudieron actualizar los productos seleccionados.");
        return;
      }
      const updatedById = new Map<string, ProductListItem>((data.products ?? []).map((product: ProductListItem) => [product.id, product]));
      setProducts((current) => current.map((product) => updatedById.get(product.id) ?? product));
      setPage(1);
      if (change.action === "category") await refreshCategories();
      clearSelection();
      router.refresh();
    } catch {
      setError("No se pudo conectar para actualizar los productos seleccionados.");
    } finally {
      setBulkBusy(false);
    }
  }

  function applyBulkCategory() {
    if (!bulkCategoryId) return;
    const creating = bulkCategoryId === "__new";
    const categoryName = bulkCategoryName.trim();
    if (creating && categoryName.length < 2) {
      setError("Ingresá un nombre de categoría de al menos 2 caracteres.");
      return;
    }
    void applyBulkUpdate({
      action: "category",
      categoryId: bulkCategoryId === "none" ? null : bulkCategoryId,
      ...(creating ? { categoryName } : {})
    });
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
    setActionsProduct(null);
    resetDraft();
    setProductModalOpen(true);
  }

  function openEditProduct(product: ProductListItem) {
    setActionsProduct(null);
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
          ? { ...group, options: [...group.options, { name: "", priceDelta: "", isAvailable: true, colorHex: "" }] }
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
          options: values.map((value) => ({ name: value, priceDelta: "", isAvailable: true, colorHex: "" }))
        }
      ]
    }));
    setVariantDrawer(null);
    setNewVariantValue("");
    setError("");
  }

  async function saveQuickProductChange(product: ProductListItem, change: { action: "visibility"; isVisible: boolean }) {
    setQuickUpdateProductId(product.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "No se pudo actualizar el producto.");
        return;
      }
      setProducts((current) => current.map((item) => (item.id === product.id ? data.product : item)));
      router.refresh();
    } catch {
      setError("No se pudo conectar para actualizar el producto. Intentá nuevamente.");
    } finally {
      setQuickUpdateProductId(null);
    }
  }

  function toggleVariantDetails(productId: string) {
    setExpandedVariantProducts((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
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
    if (!editingProductId) setPage(1);
    await refreshCategories();
    resetDraft();
    setProductModalOpen(false);
    router.refresh();
  }

  async function toggleProductVisibility(product: ProductListItem) {
    await saveQuickProductChange(product, { action: "visibility", isVisible: !product.isVisible });
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
    setSelectedProductIds((current) => {
      const next = new Set(current);
      next.delete(product.id);
      return next;
    });
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-b border-line p-3 sm:flex sm:items-center sm:p-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar productos por nombre o categoría</span>
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field !min-h-12 !pl-10" placeholder="Buscar por nombre o categoría" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); clearSelection(); }} />
          </label>
          <button className="btn-secondary relative !min-h-12 !w-12 !rounded-xl !p-0 sm:!w-auto sm:!px-4" type="button" onClick={() => setFilterModalOpen(true)} aria-label="Abrir filtros" aria-haspopup="dialog" aria-expanded={filterModalOpen}>
            <SlidersHorizontal size={17} /> <span className="hidden sm:inline">Filtrar</span>
            {activeFilterCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-black text-white">{activeFilterCount}</span> : null}
          </button>
          <button className="btn-secondary !min-h-12 !w-12 !rounded-xl !p-0 sm:!w-auto sm:!px-4" type="button" onClick={openSortMenu} aria-label={`Orden en la tienda: ${PRODUCT_SORT_LABELS[productSort].title}`} aria-haspopup="dialog" aria-expanded={Boolean(sortMenuPosition)}>
            <ArrowUpDown size={17} /> <span className="hidden sm:inline">Orden: <span className="text-brand">{PRODUCT_SORT_LABELS[productSort].title}</span></span>
          </button>
          <button className="btn-primary col-span-3 !min-h-12 w-full whitespace-nowrap sm:col-span-1 sm:ml-auto sm:w-auto" type="button" onClick={openNewProduct}>
            <Plus size={17} /> Nuevo producto
          </button>
        </div>

        {error && !isProductModalOpen && !priceStockProduct && !sortMenuPosition && !bulkDeleteOpen ? <p className="border-b border-line bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm sm:px-4">
          <label className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5">
            <input ref={selectAllRef} className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-400 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="checkbox" checked={allFilteredSelected} onChange={toggleAllFilteredProducts} disabled={filteredProducts.length === 0} aria-label="Seleccionar todos los productos filtrados" />
            <span className="truncate font-bold">{selectedProductIds.size ? `${selectedProductIds.size} seleccionados` : `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"}`}</span>
          </label>
          {selectedProductIds.size ? <button className="shrink-0 font-bold text-brand underline underline-offset-4" type="button" onClick={clearSelection}>Limpiar selección</button> : activeFilterCount ? <button className="shrink-0 font-bold text-brand underline underline-offset-4" type="button" onClick={clearProductFilters}>Limpiar filtros</button> : <Link className="shrink-0 text-right font-bold text-brand" href="/gestion/categorias">Administrar categorías</Link>}
        </div>

        {manualOrder ? <p className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 text-xs font-semibold text-muted sm:px-4">
          <GripVertical size={14} aria-hidden="true" className="shrink-0 text-brand" />
          {canDrag ? "Arrastrá desde la manija para cambiar el orden de la tienda." : "Para mover productos, quitá la búsqueda y los filtros."}
          {orderBusy ? <span className="ml-auto shrink-0 font-bold">Guardando…</span> : null}
        </p> : null}

        {selectedProductIds.size ? <div className="hidden gap-2 border-b border-line bg-surface px-3 py-2.5 sm:flex sm:flex-wrap sm:items-center sm:px-4">
          <p className="w-full text-xs font-bold text-muted sm:w-auto sm:pr-1">Editar selección</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => void applyBulkUpdate({ action: "visibility", isVisible: true })} disabled={bulkBusy || selectedProducts.every((product) => product.isVisible)}>
              <Eye size={15} /> Mostrar
            </button>
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => void applyBulkUpdate({ action: "visibility", isVisible: false })} disabled={bulkBusy || selectedProducts.every((product) => !product.isVisible)}>
              <EyeOff size={15} /> Ocultar
            </button>
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-xs" type="button" onClick={() => { setBulkCategoryOpen((open) => !open); setBulkCategoryId(""); setBulkCategoryName(""); }} aria-expanded={bulkCategoryOpen}>
              <Tag size={15} /> Categoría
            </button>
            <span className="mx-0.5 w-px self-stretch bg-line" aria-hidden="true" />
            <button className="btn-secondary !min-h-10 !rounded-xl !border-red-200 !px-3 !py-2 text-xs !text-red-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
              <Trash2 size={15} /> Eliminar {selectedProductIds.size}
            </button>
            {bulkBusy ? <span className="self-center text-xs font-bold text-muted">Guardando…</span> : null}
          </div>
        </div> : null}

        {selectedProductIds.size && bulkCategoryOpen ? <div ref={bulkCategoryRef} className="grid gap-2 border-b border-line bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-4">
          <label className="grid gap-1 text-xs font-bold text-muted">
            Categoría para {selectedProductIds.size} producto{selectedProductIds.size === 1 ? "" : "s"}
            <select className="field !min-h-11 !rounded-xl !py-2 text-sm" value={bulkCategoryId} onChange={(event) => { setBulkCategoryId(event.target.value); setBulkCategoryName(""); }} disabled={bulkBusy}>
              <option value="">Elegí una categoría</option>
              <option value="none">Sin categoría</option>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              <option value="__new">+ Crear categoría</option>
            </select>
          </label>
          {bulkCategoryId === "__new" ? <label className="grid gap-1 text-xs font-bold text-muted">
            Nombre de categoría
            <input className="field !min-h-11 !rounded-xl !py-2 text-sm" placeholder="Principales" value={bulkCategoryName} onChange={(event) => setBulkCategoryName(event.target.value)} maxLength={80} disabled={bulkBusy} />
          </label> : <p className="pb-2 text-xs leading-relaxed text-muted">El cambio se aplica a toda la selección, incluso en otras páginas.</p>}
          <div className="flex gap-2 sm:pb-0.5">
            <button className="btn-primary !min-h-10 flex-1 !rounded-xl !px-3 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none" type="button" onClick={applyBulkCategory} disabled={bulkBusy || !bulkCategoryId || (bulkCategoryId === "__new" && bulkCategoryName.trim().length < 2)}>
              {bulkBusy ? "Guardando…" : "Aplicar"}
            </button>
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm" type="button" onClick={() => setBulkCategoryOpen(false)} disabled={bulkBusy}>Cancelar</button>
          </div>
        </div> : null}

        <div ref={listRef} className="divide-y divide-line">
          {filteredProducts.length === 0 ? (
            <div className="p-5">
              <p className="font-bold">{products.length ? "No encontramos productos con esos filtros." : "Todavía no hay productos para mostrar."}</p>
              {products.length ? <p className="mt-1 text-sm text-muted">Probá cambiar la búsqueda o quitar algún filtro.</p> : <p className="mt-1 text-sm text-muted">Cuando agregues uno, va a aparecer acá.</p>}
            </div>
          ) : (
            pageProducts.map((product, index) => {
              const label = discountLabel(product);
              const variantCount = product.optionGroups.reduce((total, group) => total + group.options.length, 0);
              const variantsExpanded = expandedVariantProducts.includes(product.id);
              const quickUpdateBusy = quickUpdateProductId === product.id;
              const dragging = dragState?.id === product.id;
              const dropMoves = dragState ? dragState.over !== dragState.from && dragState.over !== dragState.from + 1 : false;
              const dropBefore = dropMoves && dragState?.over === index;
              const dropAfter = dropMoves && index === pageProducts.length - 1 && dragState?.over === pageProducts.length;
              return (
                <article key={product.id} data-product-row className={`relative px-3 py-3 sm:p-4 ${dragging ? "z-[1] rounded-2xl bg-white shadow-[0_14px_30px_rgba(196,87,130,0.25)] ring-2 ring-brand" : ""}`}>
                  {dropBefore ? <span className="pointer-events-none absolute inset-x-3 -top-[2px] z-[2] h-[3px] rounded-full bg-brand" aria-hidden="true" /> : null}
                  {dropAfter ? <span className="pointer-events-none absolute inset-x-3 -bottom-[2px] z-[2] h-[3px] rounded-full bg-brand" aria-hidden="true" /> : null}
                  <div className={`grid items-center gap-2 sm:gap-4 ${manualOrder ? "grid-cols-[16px_20px_56px_minmax(0,1fr)_auto] sm:grid-cols-[18px_24px_76px_minmax(0,1fr)_auto]" : "grid-cols-[20px_56px_minmax(0,1fr)_auto] sm:grid-cols-[24px_76px_minmax(0,1fr)_auto]"}`}>
                    {manualOrder ? (
                      <button
                        className={`grid h-11 w-4 touch-none place-items-center text-slate-400 sm:w-[18px] ${canDrag && !orderBusy ? (dragging ? "cursor-grabbing text-brand" : "cursor-grab hover:text-brand") : "cursor-not-allowed opacity-30"}`}
                        type="button"
                        aria-label={`Mover ${product.name}`}
                        title={canDrag ? "Arrastrá para mover" : "Quitá la búsqueda y los filtros para mover"}
                        disabled={!canDrag || orderBusy}
                        onPointerDown={(event) => startDrag(event, product.id, index)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={() => setDragState(null)}
                      >
                        <GripVertical size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                    <label className="grid min-h-9 min-w-5 cursor-pointer place-items-center" aria-label={`Seleccionar ${product.name}`}>
                      <input className="h-5 w-5 cursor-pointer rounded border-slate-400 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" type="checkbox" checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} />
                    </label>

                    <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-surface sm:h-[76px] sm:w-[76px]">
                      {product.imageUrls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
                      ) : <div className="grid h-full place-items-center px-1 text-center text-[10px] font-bold text-muted">Sin imagen</div>}
                      {label ? <span className="absolute left-1 top-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">{label}</span> : null}
                    </div>

                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-[13px] font-extrabold leading-[1.2] sm:text-base">{product.name}</h2>
                      <p className="mt-1 truncate text-[10px] font-semibold leading-tight text-muted sm:text-xs">
                        <span className={product.isVisible ? "text-green-800" : "text-slate-600"}>{product.isVisible ? "Visible" : "Oculto"}</span> · {stockLabel(product)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <strong className={label ? "text-base leading-none text-red-600 sm:text-lg" : "text-base leading-none sm:text-lg"}>{formatMoney(effectivePrice(product))}</strong>
                        {label ? <span className="text-[10px] font-bold text-muted line-through sm:text-xs">{formatMoney(product.basePrice)}</span> : null}
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="inline-flex max-w-[140px] items-center gap-1 truncate text-[10px] font-bold text-brand sm:text-xs"><Tag size={12} /> {product.category?.name ?? "Sin categoría"}</span>
                        {variantCount ? <button className="inline-flex min-h-7 items-center gap-0.5 text-[10px] font-bold text-muted sm:text-xs" type="button" onClick={() => toggleVariantDetails(product.id)} aria-expanded={variantsExpanded}>
                          <ChevronDown size={13} className={variantsExpanded ? "rotate-180 transition-transform" : "transition-transform"} /> {variantsExpanded ? "Ocultar" : `${variantCount} variante${variantCount === 1 ? "" : "s"}`}
                        </button> : null}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <button className="btn-secondary !h-9 !w-9 !rounded-xl !p-0 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={(event) => openProductMenu(event, product)} disabled={quickUpdateBusy || bulkBusy} aria-label={`Más acciones para ${product.name}`} aria-haspopup="menu" aria-expanded={actionsProduct?.id === product.id}>
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                  </div>

                  {variantsExpanded ? <div className="mt-3 grid gap-2 rounded-xl border border-line px-3 py-2.5 sm:ml-20">
                    {product.optionGroups.map((group) => <p key={group.id} className="text-xs text-muted"><strong className="text-ink">{group.name}:</strong> {group.options.map((option) => option.name).join(", ")}</p>)}
                  </div> : null}
                </article>
              );
            })
          )}
        </div>

        {filteredProducts.length > PRODUCT_PAGE_SIZE ? <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-muted">Mostrando {(currentPage - 1) * PRODUCT_PAGE_SIZE + 1}–{Math.min(currentPage * PRODUCT_PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length}</p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <span className="min-w-20 text-center text-sm font-bold">{currentPage} / {pageCount}</span>
            <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm" type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage === pageCount}>
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div> : null}
      </section>

      {selectedProductIds.size ? <>
        {/* Phones: the selection actions float at the bottom so they stay reachable while scrolling. */}
        <div className="h-20 sm:hidden" aria-hidden="true" />
        <div className="fixed inset-x-3 bottom-3 z-[60] flex items-center gap-1.5 rounded-2xl bg-[#2a1e29] py-2 pl-4 pr-2 text-white shadow-[0_14px_30px_rgba(0,0,0,0.25)] sm:hidden" role="toolbar" aria-label="Acciones para los productos seleccionados">
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{selectedProductIds.size} seleccionado{selectedProductIds.size === 1 ? "" : "s"}</p>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 disabled:opacity-40" type="button" aria-label="Mostrar en la tienda" onClick={() => void applyBulkUpdate({ action: "visibility", isVisible: true })} disabled={bulkBusy || selectedProducts.every((product) => product.isVisible)}><Eye size={18} /></button>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 disabled:opacity-40" type="button" aria-label="Ocultar de la tienda" onClick={() => void applyBulkUpdate({ action: "visibility", isVisible: false })} disabled={bulkBusy || selectedProducts.every((product) => !product.isVisible)}><EyeOff size={18} /></button>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 disabled:opacity-40" type="button" aria-label="Cambiar categoría" onClick={openBulkCategoryPicker} disabled={bulkBusy}><Tag size={18} /></button>
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5484d] disabled:opacity-40" type="button" aria-label={`Eliminar ${selectedProductIds.size} productos`} onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}><Trash2 size={18} /></button>
        </div>
      </> : null}

      {notice ? <p className="fixed bottom-5 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-2xl bg-[#2a1e29] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)]" role="status"><Check size={17} className="text-green-300" aria-hidden="true" /> {notice}</p> : null}

      {sortMenuPosition ? <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 sm:block sm:bg-transparent" role="presentation" onClick={() => setSortMenuPosition(null)}>
        <section className="grid max-h-[88dvh] w-full gap-1 overflow-y-auto rounded-t-3xl bg-white p-4 pb-5 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:absolute sm:w-[340px] sm:rounded-2xl sm:border sm:border-line sm:p-2 sm:shadow-[0_18px_50px_rgba(52,38,53,0.2)]" style={sortMenuPosition} role="dialog" aria-modal="true" aria-labelledby="product-sort-title" onClick={(event) => event.stopPropagation()}>
          <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <header className="px-2 pb-2 pt-1">
            <h2 id="product-sort-title" className="font-black sm:text-sm">Orden en la tienda</h2>
            <p className="text-sm text-muted sm:text-xs">Así se muestran los productos a tus clientas.</p>
          </header>
          <fieldset className="grid gap-0.5" disabled={orderBusy}>
            <legend className="sr-only">Orden de los productos</legend>
            {PRODUCT_SORTS.map((sort) => <label key={sort} className={`grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-start gap-3 rounded-xl px-2.5 py-2.5 ${productSort === sort ? "bg-blush/50" : "hover:bg-surface"}`}>
              <input className="mt-0.5 h-[18px] w-[18px] accent-brand" type="radio" name="product-sort" checked={productSort === sort} onChange={() => void saveSortSettings({ productSort: sort, soldOutLast })} />
              <span><b className="block text-sm">{PRODUCT_SORT_LABELS[sort].title}</b><span className="block text-xs text-muted">{PRODUCT_SORT_LABELS[sort].hint}</span></span>
            </label>)}
          </fieldset>
          <label className="mt-1 flex cursor-pointer items-center gap-3 border-t border-line px-2.5 pb-1 pt-3 text-sm font-semibold">
            <input className="h-[18px] w-[18px] accent-brand" type="checkbox" checked={soldOutLast} disabled={orderBusy} onChange={(event) => void saveSortSettings({ productSort, soldOutLast: event.target.checked })} />
            Mandar los sin stock al final
          </label>
          {error ? <p className="mx-2 mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          <button className="btn-primary mt-3 min-h-12 !rounded-2xl sm:hidden" type="button" onClick={() => setSortMenuPosition(null)}>Listo</button>
        </section>
      </div> : null}

      {bulkDeleteOpen && selectedProducts.length ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => { if (!bulkBusy) setBulkDeleteOpen(false); }}>
        <section className="panel grid max-h-[92dvh] w-full max-w-md gap-4 overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title" aria-describedby="bulk-delete-text" onClick={(event) => event.stopPropagation()}>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-700" aria-hidden="true"><Trash2 size={20} /></span>
          <div>
            <h2 id="bulk-delete-title" className="text-xl font-black">¿Eliminar {selectedProducts.length === 1 ? "1 producto" : `${selectedProducts.length} productos`}?</h2>
            <p id="bulk-delete-text" className="mt-1 text-sm text-muted">Se borran de la tienda y del panel, junto con sus fotos. No se puede deshacer.</p>
          </div>
          <ul className="grid gap-2 rounded-2xl border border-line bg-surface p-2.5">
            {selectedProducts.slice(0, 4).map((product) => <li key={product.id} className="flex items-center gap-2.5 text-sm font-bold">
              {product.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrls[0]} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              ) : <span className="h-9 w-9 shrink-0 rounded-lg bg-blush" />}
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              <span className="shrink-0 font-semibold text-muted">{formatMoney(effectivePrice(product))}</span>
            </li>)}
            {selectedProducts.length > 4 ? <li className="pl-1 text-sm font-semibold text-muted">y {selectedProducts.length - 4} más</li> : null}
          </ul>
          <p className="text-xs text-muted">
            Los pedidos que ya recibiste no cambian.
            {selectedProducts.some((product) => product.isVisible) ? <span className="hidden sm:inline"> ¿Solo querés sacarlos de la tienda? <button className="font-bold text-brand underline underline-offset-2" type="button" onClick={hideSelectedInstead} disabled={bulkBusy}>Ocultalos</button>.</span> : null}
          </p>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          <div className="grid gap-2 border-t border-line pt-4 sm:flex sm:justify-end">
            <button className="btn-primary min-h-11 !rounded-xl !bg-red-700 !bg-none disabled:cursor-not-allowed disabled:opacity-60 sm:order-2" type="button" onClick={() => void deleteSelectedProducts()} disabled={bulkBusy}>
              <Trash2 size={17} /> {bulkBusy ? "Eliminando…" : `Eliminar ${selectedProducts.length === 1 ? "1 producto" : `${selectedProducts.length} productos`}`}
            </button>
            {selectedProducts.some((product) => product.isVisible) ? <button className="btn-secondary min-h-11 !rounded-xl sm:hidden" type="button" onClick={hideSelectedInstead} disabled={bulkBusy}><EyeOff size={17} /> Mejor ocultarlos</button> : null}
            <button className="btn-secondary min-h-11 !rounded-xl !border-transparent sm:order-1" type="button" onClick={() => setBulkDeleteOpen(false)} disabled={bulkBusy}>Cancelar</button>
          </div>
        </section>
      </div> : null}

      {filterModalOpen ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setFilterModalOpen(false)}>
        <section className="panel grid max-h-[90dvh] w-full max-w-lg gap-5 overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="product-filter-title" onClick={(event) => event.stopPropagation()}>
          <header className="flex items-start justify-between gap-4">
            <div><h2 id="product-filter-title" className="text-xl font-black">Filtrar productos</h2><p className="mt-1 text-sm text-muted">Combiná las opciones para acotar la lista.</p></div>
            <button className="btn-secondary !h-10 !w-10 !rounded-xl !p-0" type="button" onClick={() => setFilterModalOpen(false)} aria-label="Cerrar filtros"><X size={18} /></button>
          </header>
          <label className="grid gap-2 text-sm font-bold">Categoría
            <select className="field" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); clearSelection(); }}>
              <option value="all">Todas las categorías</option>
              <option value="none">Sin categoría</option>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-bold">Disponibilidad en la web</legend>
            {([ ["all", "Todos"], ["visible", "Visibles"], ["hidden", "Ocultos"] ] as const).map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 ${visibilityFilter === value ? "border-brand bg-blush/50" : "border-line bg-white"}`}>
              <input type="radio" name="product-visibility-filter" value={value} checked={visibilityFilter === value} onChange={() => { setVisibilityFilter(value); setPage(1); clearSelection(); }} />
              <span className="text-sm font-semibold">{label}</span>
            </label>)}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-bold">Estado del producto</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3">
              <input type="checkbox" checked={lowStockFilter} onChange={(event) => { setLowStockFilter(event.target.checked); setPage(1); clearSelection(); }} />
              <span className="text-sm font-semibold">Bajo stock <span className="font-normal text-muted">(menos de 5 unidades)</span></span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3">
              <input type="checkbox" checked={promoFilter} onChange={(event) => { setPromoFilter(event.target.checked); setPage(1); clearSelection(); }} />
              <span className="text-sm font-semibold">Productos en oferta</span>
            </label>
          </fieldset>
          <div className="flex gap-2 border-t border-line pt-4">
            <button className="btn-secondary min-h-11 flex-1 !rounded-xl" type="button" onClick={clearProductFilters}>Limpiar</button>
            <button className="btn-primary min-h-11 flex-1 !rounded-xl" type="button" onClick={() => setFilterModalOpen(false)}>Ver {filteredProducts.length} productos</button>
          </div>
        </section>
      </div> : null}

      {actionsProduct ? <>
        <button className="fixed inset-0 z-[75] cursor-default bg-transparent" type="button" aria-label="Cerrar menú de acciones" onClick={() => closeProductMenu()} />
        <div className="fixed z-[76] w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[0_10px_35px_rgba(52,38,53,0.2)]" style={actionsMenuPosition} role="menu" aria-label={`Acciones para ${actionsProduct.name}`}>
          <button ref={menuFirstActionRef} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-brand hover:bg-lilac focus-visible:bg-lilac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" type="button" role="menuitem" onClick={() => openDuplicateProduct(actionsProduct)}>
            <Copy size={18} aria-hidden="true" /> Duplicar producto
          </button>
          <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" type="button" role="menuitem" onClick={() => openEditProduct(actionsProduct)}>
            <Pencil size={18} aria-hidden="true" /> Editar producto
          </button>
          <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" type="button" role="menuitem" onClick={() => openPriceStockEditor(actionsProduct)}>
            <Pencil size={18} aria-hidden="true" /> Editar precio y stock
          </button>
          <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2" type="button" role="menuitem" onClick={() => { const product = actionsProduct; setActionsProduct(null); void toggleProductVisibility(product); }} disabled={quickUpdateProductId === actionsProduct.id}>
            {actionsProduct.isVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            {actionsProduct.isVisible ? "Ocultar producto" : "Mostrar producto"}
          </button>
          {manualOrder ? <>
            <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50" type="button" role="menuitem" disabled={orderBusy} onClick={() => { const product = actionsProduct; setActionsProduct(null); moveProduct(product.id, "start"); }}>
              <ArrowUpToLine size={18} aria-hidden="true" /> Mover al principio
            </button>
            <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50" type="button" role="menuitem" disabled={orderBusy} onClick={() => { const product = actionsProduct; setActionsProduct(null); moveProduct(product.id, "end"); }}>
              <ArrowDownToLine size={18} aria-hidden="true" /> Mover al final
            </button>
          </> : null}
          <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2" type="button" role="menuitem" onClick={() => { const product = actionsProduct; setActionsProduct(null); void deleteProduct(product); }}>
            <Trash2 size={18} aria-hidden="true" /> Borrar producto
          </button>
        </div>
      </> : null}

      {priceStockProduct ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => { if (!priceStockBusy) setPriceStockProduct(null); }}>
        <form className="panel grid max-h-[92dvh] w-full max-w-lg gap-5 overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="price-stock-title" onClick={(event) => event.stopPropagation()} onSubmit={savePriceStock}>
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="price-stock-title" className="text-xl font-black">Precio y stock</h2>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{priceStockProduct.name}</p>
            </div>
            <button className="btn-secondary !h-10 !w-10 shrink-0 !rounded-xl !p-0" type="button" onClick={() => setPriceStockProduct(null)} disabled={priceStockBusy} aria-label="Cerrar precio y stock"><X size={18} /></button>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">Precio
              <PriceInput value={priceStockDraft.basePrice} onChange={(basePrice) => setPriceStockDraft((current) => ({ ...current, basePrice }))} placeholder="10.000" required />
            </label>
            <label className="grid gap-2 text-sm font-bold">Precio en oferta
              <PriceInput value={priceStockDraft.promoPrice} onChange={(promoPrice) => setPriceStockDraft((current) => ({ ...current, promoPrice }))} placeholder="Opcional" tone="promo" />
            </label>
          </div>
          <div className="grid gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold">
              <input className="h-5 w-5 accent-brand" type="checkbox" checked={priceStockDraft.stockLimited} onChange={(event) => setPriceStockDraft((current) => ({ ...current, stockLimited: event.target.checked }))} />
              Controlar stock
            </label>
            {priceStockDraft.stockLimited ? <label className="grid gap-2 text-sm font-bold">Unidades disponibles
              <input className="field" inputMode="numeric" placeholder="10" value={priceStockDraft.stockQuantity} onChange={(event) => setPriceStockDraft((current) => ({ ...current, stockQuantity: formatInteger(event.target.value) }))} />
            </label> : <p className="text-sm text-muted">Stock ilimitado</p>}
          </div>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          <div className="flex gap-2 border-t border-line pt-4">
            <button className="btn-secondary min-h-11 flex-1 !rounded-xl" type="button" onClick={() => setPriceStockProduct(null)} disabled={priceStockBusy}>Cancelar</button>
            <button className="btn-primary min-h-11 flex-1 !rounded-xl disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={priceStockBusy}>
              <Save size={17} /> {priceStockBusy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div> : null}

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

              <details className="rounded-2xl border border-line bg-white">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block text-sm font-black">Opciones de variante</span>
                    <span className="mt-0.5 block text-xs font-semibold text-muted">Color, talle u otras opciones</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold text-muted">
                    {draft.optionGroups.length ? `${draft.optionGroups.length} propiedad${draft.optionGroups.length === 1 ? "" : "es"}` : "Opcional"}
                    <ChevronDown size={17} />
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-line p-3">
                  <Toggle
                    checked={draft.variantsEnabled}
                    onChange={toggleVariants}
                    label="Usar variantes"
                    description="Permití que el cliente elija entre opciones del producto."
                  />

                  {draft.variantsEnabled ? (
                    <section className="grid gap-3 rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Propiedades</h3>
                      <p className="text-sm font-semibold text-muted">Cada propiedad se muestra como una elección obligatoria. Si le cargás un color a cada valor, la tienda muestra el color en vez del texto solo.</p>
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
                              <div key={optionIndex} className="grid grid-cols-[1fr_auto_auto] gap-2 sm:grid-cols-[1fr_150px_auto_auto]">
                                <label className="grid gap-1 text-xs font-bold text-muted">
                                  Valor
                                  <input className="field !px-3 !py-2" placeholder="Rojo" value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })} />
                                </label>
                                <label className="col-span-3 grid gap-1 text-xs font-bold text-muted sm:col-span-1">
                                  Precio extra
                                  <PriceInput value={option.priceDelta} onChange={(value) => updateOption(groupIndex, optionIndex, { priceDelta: value })} placeholder="0" />
                                </label>
                                <OptionColorPicker
                                  value={option.colorHex}
                                  label={option.name}
                                  onChange={(colorHex) => updateOption(groupIndex, optionIndex, { colorHex })}
                                />
                                <button className="mt-5 h-12 rounded-xl border border-line px-2 text-red-600" type="button" onClick={() => removeOption(groupIndex, optionIndex)} aria-label="Eliminar valor">
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
                </div>
              </details>

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
