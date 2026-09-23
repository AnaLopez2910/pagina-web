"use client";

import {
  Banknote,
  Check,
  Edit2,
  Eye,
  ListFilter,
  PackageCheck,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { WhatsappIcon } from "@/components/public-store";
import { formatBuenosAiresDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { calculateOrderCost, calculateOrderProfit, isRevenueStatus } from "@/lib/order-financials";
import { normalizeArgentineWhatsAppPhone } from "@/lib/store-settings";

type OrderStatus = "PENDING_WHATSAPP" | "PAID" | "DELIVERED" | "CANCELLED";
type StatusFilter = OrderStatus | "all";
type TimeFilter = "today" | "yesterday" | "week" | "month" | "year" | "always" | "custom";

type AdvancedFilters = {
  timeFilter: TimeFilter;
  customFrom: string;
  customTo: string;
  priceMin: string;
  priceMax: string;
};

type OrderItemOption = {
  groupName?: string;
  optionName?: string;
  priceDelta?: number;
};

type AdminProduct = {
  id: string;
  name: string;
  basePrice: number;
  promoPrice: number | null;
  purchasePrice: number;
  optionGroups: Array<{
    id: string;
    name: string;
    selectionType: "SINGLE" | "MULTIPLE";
    isRequired: boolean;
    maxSelections: number | null;
    options: Array<{ id: string; name: string; priceDelta: number; isAvailable: boolean }>;
  }>;
};

type OrderListItem = {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  notes: string | null;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    purchasePrice: number;
    options: unknown;
    subtotal: number;
  }>;
};

type OrderItemDraft = {
  draftId: string;
  id: string | null;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  options: unknown;
  selectedOptionIds?: string[];
};

type OrderDraft = {
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  notes: string;
  items: OrderItemDraft[];
};

const statusOptions: Array<{ value: OrderStatus; label: string; plural: string }> = [
  { value: "PENDING_WHATSAPP", label: "Pendiente", plural: "Pendientes" },
  { value: "PAID", label: "Pagado", plural: "Pagados" },
  { value: "DELIVERED", label: "Entregado", plural: "Entregados" },
  { value: "CANCELLED", label: "Cancelado", plural: "Cancelados" }
];

const filterOptions: Array<{ value: StatusFilter; label: string; icon: LucideIcon }> = [
  { value: "all", label: "Todos", icon: ListFilter },
  { value: "PENDING_WHATSAPP", label: "Pendientes", icon: Banknote },
  { value: "PAID", label: "Pagados", icon: Check },
  { value: "DELIVERED", label: "Entregados", icon: PackageCheck },
  { value: "CANCELLED", label: "Cancelados", icon: X }
];

const timeFilterOptions: Array<{ value: TimeFilter; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "year", label: "Este año" },
  { value: "always", label: "Siempre" },
  { value: "custom", label: "Personalizado" }
];

const emptyAdvancedFilters: AdvancedFilters = {
  timeFilter: "always",
  customFrom: "",
  customTo: "",
  priceMin: "",
  priceMax: ""
};

const statusFilterValues = new Set<StatusFilter>(filterOptions.map((option) => option.value));
const timeFilterValues = new Set<TimeFilter>(timeFilterOptions.map((option) => option.value));

function isStatusFilter(value: string | null): value is StatusFilter {
  return value !== null && statusFilterValues.has(value as StatusFilter);
}

function isTimeFilter(value: string | null): value is TimeFilter {
  return value !== null && timeFilterValues.has(value as TimeFilter);
}

function isDateFilter(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatPriceFilterQuery(value: string) {
  const parsed = parsePriceFilter(value);
  return parsed === null ? "" : String(parsed);
}

function filtersFromSearchParams(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const time = searchParams.get("time");
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  return {
    statusFilter: isStatusFilter(status) ? status : "all",
    advancedFilters: {
      timeFilter: isTimeFilter(time) ? time : "always",
      customFrom: isDateFilter(customFrom) ? customFrom : "",
      customTo: isDateFilter(customTo) ? customTo : "",
      priceMin: minPrice ? formatPriceFilterInput(minPrice) : "",
      priceMax: maxPrice ? formatPriceFilterInput(maxPrice) : ""
    }
  } satisfies { statusFilter: StatusFilter; advancedFilters: AdvancedFilters };
}

function statusLabel(status: OrderStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function statusBadgeClass(status: OrderStatus) {
  if (status === "PAID") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "DELIVERED") {
    return "bg-green-100 text-green-800";
  }
  if (status === "CANCELLED") {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-800";
}

function filterBadgeClass(status: StatusFilter, isActive: boolean) {
  if (status === "PAID") {
    return isActive ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700";
  }
  if (status === "DELIVERED") {
    return isActive ? "bg-green-600 text-white" : "bg-green-50 text-green-700";
  }
  if (status === "CANCELLED") {
    return isActive ? "bg-red-600 text-white" : "bg-red-50 text-red-700";
  }
  if (status === "PENDING_WHATSAPP") {
    return isActive ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700";
  }
  return isActive ? "bg-brand text-white" : "bg-surface text-muted";
}

function argentinaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addArgentinaDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return argentinaDateString(date);
}

function argentinaDayBoundary(dateString: string, boundary: "start" | "end") {
  const [year, month, day] = dateString.split("-").map(Number);
  const hours = boundary === "start" ? 0 : 23;
  const minutes = boundary === "start" ? 0 : 59;
  const seconds = boundary === "start" ? 0 : 59;
  const milliseconds = boundary === "start" ? 0 : 999;

  // Argentina is UTC-03:00. Building the timestamp from UTC avoids parsing
  // a local date in the browser's timezone before comparing it with ISO dates.
  return Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds) + 3 * 60 * 60 * 1000;
}

function argentinaDateRange(timeFilter: TimeFilter, customFrom: string, customTo: string) {
  if (timeFilter === "always") {
    return { from: null, to: null };
  }

  const today = argentinaDateString();
  if (timeFilter === "today") {
    return { from: argentinaDayBoundary(today, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "yesterday") {
    const yesterday = addArgentinaDays(today, -1);
    return { from: argentinaDayBoundary(yesterday, "start"), to: argentinaDayBoundary(yesterday, "end") };
  }

  if (timeFilter === "week") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const mondayOffset = (weekday + 6) % 7;
    const monday = addArgentinaDays(today, -mondayOffset);
    return { from: argentinaDayBoundary(monday, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "month") {
    return { from: argentinaDayBoundary(`${today.slice(0, 7)}-01`, "start"), to: argentinaDayBoundary(today, "end") };
  }

  if (timeFilter === "year") {
    return { from: argentinaDayBoundary(`${today.slice(0, 4)}-01-01`, "start"), to: argentinaDayBoundary(today, "end") };
  }

  return {
    from: customFrom ? argentinaDayBoundary(customFrom, "start") : null,
    to: customTo ? argentinaDayBoundary(customTo, "end") : null
  };
}

function parsePriceFilter(value: string) {
  const raw = value.replace(/\s/g, "").replace(/^\$/, "");
  if (!raw) {
    return null;
  }

  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) {
    // Argentine format with thousands dots and decimal comma: 1.234,50.
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    // Argentine thousands format: 1.234.567.
    normalized = raw.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    normalized = raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function formatPriceFilterInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("es-AR") : "";
}

function PriceFilterInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <span className="field grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 !px-4 !py-0">
        <span className="flex h-full items-center justify-center font-black leading-none text-ink">$</span>
        <input
          className="min-w-0 bg-transparent py-3 text-[inherit] font-semibold text-ink outline-none placeholder:text-muted"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(formatPriceFilterInput(event.target.value))}
        />
      </span>
    </label>
  );
}

function normalizeOrderOptions(options: unknown): OrderItemOption[] {
  if (!Array.isArray(options)) {
    return [];
  }
  return options
    .map((option) => {
      if (!option || typeof option !== "object") {
        return null;
      }
      const record = option as Record<string, unknown>;
      return {
        groupName: typeof record.groupName === "string" ? record.groupName : undefined,
        optionName: typeof record.optionName === "string" ? record.optionName : undefined,
        priceDelta: typeof record.priceDelta === "number" ? record.priceDelta : undefined
      };
    })
    .filter(Boolean) as OrderItemOption[];
}

function orderToDraft(order: OrderListItem): OrderDraft {
  return {
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    notes: order.notes ?? "",
    items: order.items.map((item) => ({ ...item, draftId: item.id, id: item.id, selectedOptionIds: undefined }))
  };
}

function draftItemUnitPrice(item: OrderItemDraft, productsById: Map<string, AdminProduct>) {
  if (item.id !== null || !item.productId) return item.unitPrice;
  const product = productsById.get(item.productId);
  if (!product) return item.unitPrice;
  const selectedOptionIds = new Set(item.selectedOptionIds ?? []);
  return (product.promoPrice ?? product.basePrice) + product.optionGroups.reduce(
    (sum, group) => sum + group.options.reduce((groupSum, option) => selectedOptionIds.has(option.id) ? groupSum + option.priceDelta : groupSum, 0),
    0
  );
}

function orderWhatsAppHref(order: OrderListItem) {
  const phone = normalizeArgentineWhatsAppPhone(order.customerPhone);
  return phone ? `https://wa.me/${phone}` : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printableOrderHtml(order: OrderListItem) {
  const items = order.items
    .map((item) => {
      const options = normalizeOrderOptions(item.options)
        .map((option) => `<li>${escapeHtml(option.groupName ? `${option.groupName}: ` : "")}${escapeHtml(option.optionName ?? "")}${option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}</li>`)
        .join("");
      return `
        <tr>
          <td>
            <strong>${item.quantity}x ${escapeHtml(item.productName)}</strong>
            ${options ? `<ul>${options}</ul>` : ""}
          </td>
          <td>${formatMoney(item.unitPrice)}</td>
          <td>${formatMoney(item.purchasePrice)}</td>
          <td>${formatMoney(item.subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Pedido ${escapeHtml(order.code)}</title>
        <style>
          body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; margin: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { margin: 4px 0; color: #4b5563; }
          .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 18px; }
          .badge { display: inline-block; border-radius: 999px; padding: 6px 10px; background: #ecfdf5; color: #166534; font-weight: 800; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 0; text-align: left; vertical-align: top; }
          th:nth-child(2), th:nth-child(3), th:nth-child(4), td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; white-space: nowrap; }
          ul { margin: 6px 0 0 18px; padding: 0; color: #6b7280; font-size: 13px; }
          .total { margin-top: 20px; text-align: right; font-size: 24px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="badge">${escapeHtml(statusLabel(order.status))}</span>
          <h1>Pedido #${escapeHtml(order.code)}</h1>
          <p><strong>Cliente:</strong> ${escapeHtml(order.customerName)}</p>
          <p><strong>Celular:</strong> ${escapeHtml(order.customerPhone)}</p>
          <p><strong>Entrega:</strong> ${escapeHtml(order.fulfillment)}</p>
          ${order.notes ? `<p><strong>Dirección o indicaciones:</strong> ${escapeHtml(order.notes)}</p>` : ""}
          <p><strong>Fecha:</strong> ${escapeHtml(formatBuenosAiresDate(order.createdAt))}</p>
        </div>
        <table>
          <thead>
            <tr><th>Producto</th><th>Venta unit.</th><th>Compra unit.</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
        <div class="total">Facturación: ${formatMoney(order.total)}<br />Costo: ${formatMoney(calculateOrderCost(order.items))}<br />Ganancia: ${formatMoney(calculateOrderProfit(order.total, order.items))}</div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `;
}

function printOrder(order: OrderListItem) {
  const printWindow = window.open("", "_blank", "width=520,height=720");
  if (!printWindow) {
    return;
  }
  printWindow.document.open();
  printWindow.document.write(printableOrderHtml(order));
  printWindow.document.close();
}

export function OrderManager({ orders: initialOrders, products }: { orders: OrderListItem[]; products: AdminProduct[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const urlFilters = useMemo(() => filtersFromSearchParams(new URLSearchParams(searchParamsString)), [searchParamsString]);
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const statusFilter = urlFilters.statusFilter;
  const appliedFilters = urlFilters.advancedFilters;
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(appliedFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderListItem | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [editDraft, setEditDraft] = useState<OrderDraft | null>(null);
  const [addProductId, setAddProductId] = useState("");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const actionOrder = openActionsId ? orders.find((order) => order.id === openActionsId) ?? null : null;
  useLockBodyScroll(filtersOpen || Boolean(selectedOrder) || Boolean(editingOrder) || creatingOrder || Boolean(actionOrder));

  function replaceFilterParams(nextStatusFilter: StatusFilter, nextAdvancedFilters: AdvancedFilters) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextStatusFilter === "all") {
      params.delete("status");
    } else {
      params.set("status", nextStatusFilter);
    }

    if (nextAdvancedFilters.timeFilter === "always") {
      params.delete("time");
      params.delete("from");
      params.delete("to");
    } else {
      params.set("time", nextAdvancedFilters.timeFilter);
      if (nextAdvancedFilters.timeFilter === "custom" && nextAdvancedFilters.customFrom) {
        params.set("from", nextAdvancedFilters.customFrom);
      } else {
        params.delete("from");
      }
      if (nextAdvancedFilters.timeFilter === "custom" && nextAdvancedFilters.customTo) {
        params.set("to", nextAdvancedFilters.customTo);
      } else {
        params.delete("to");
      }
    }

    const minPrice = formatPriceFilterQuery(nextAdvancedFilters.priceMin);
    const maxPrice = formatPriceFilterQuery(nextAdvancedFilters.priceMax);
    if (minPrice) {
      params.set("minPrice", minPrice);
    } else {
      params.delete("minPrice");
    }
    if (maxPrice) {
      params.set("maxPrice", maxPrice);
    } else {
      params.delete("maxPrice");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const advancedFilteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const hasAdvancedFilters =
      appliedFilters.timeFilter !== "always" ||
      appliedFilters.customFrom.trim() ||
      appliedFilters.customTo.trim() ||
      appliedFilters.priceMin.trim() ||
      appliedFilters.priceMax.trim();

    if (!normalizedQuery && !hasAdvancedFilters) {
      return orders;
    }

    const dateRange = argentinaDateRange(appliedFilters.timeFilter, appliedFilters.customFrom, appliedFilters.customTo);
    const min = parsePriceFilter(appliedFilters.priceMin);
    const max = parsePriceFilter(appliedFilters.priceMax);

    return orders.filter((order) => {
      const createdAt = Date.parse(order.createdAt);
      if (!Number.isFinite(createdAt)) {
        return false;
      }
      const matchesQuery = [order.code, order.customerName, order.customerPhone]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesFrom = dateRange.from === null || createdAt >= dateRange.from;
      const matchesTo = dateRange.to === null || createdAt <= dateRange.to;
      const matchesMin = min === null || order.total >= min;
      const matchesMax = max === null || order.total <= max;
      return matchesQuery && matchesFrom && matchesTo && matchesMin && matchesMax;
    });
  }, [orders, query, appliedFilters]);

  const counts = useMemo(() => {
    return advancedFilteredOrders.reduce<Record<StatusFilter, number>>(
      (acc, order) => {
        acc.all += 1;
        acc[order.status] += 1;
        return acc;
      },
      { all: 0, PENDING_WHATSAPP: 0, PAID: 0, DELIVERED: 0, CANCELLED: 0 }
    );
  }, [advancedFilteredOrders]);

  const filteredOrders = useMemo(() => {
    return advancedFilteredOrders.filter((order) => statusFilter === "all" || order.status === statusFilter);
  }, [advancedFilteredOrders, statusFilter]);

  const metrics = useMemo(() => {
    const revenueOrders = filteredOrders.filter((order) => isRevenueStatus(order.status));
    const paidTotal = revenueOrders.reduce((sum, order) => sum + order.total, 0);
    const paidCost = revenueOrders.reduce((sum, order) => sum + calculateOrderCost(order.items), 0);
    return { count: filteredOrders.length, paidTotal, paidCost, paidProfit: paidTotal - paidCost };
  }, [filteredOrders]);

  const activeAdvancedFilters = [
    appliedFilters.timeFilter !== "always",
    Boolean(appliedFilters.priceMin.trim()),
    Boolean(appliedFilters.priceMax.trim())
  ].filter(Boolean).length;

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    setError("");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json().catch(() => null);
    setUpdatingId(null);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el pedido.");
      return;
    }

    setOrders((current) => current.map((order) => (order.id === orderId ? data.order : order)));
    setSelectedOrder((current) => (current?.id === orderId ? data.order : current));
  }

  function openOrderEditor(order: OrderListItem) {
    setError("");
    setSelectedOrder(null);
    setCreatingOrder(false);
    setEditingOrder(order);
    setEditDraft(orderToDraft(order));
    setAddProductId("");
    setOpenActionsId(null);
  }

  function openCreateOrder() {
    setError("");
    setSelectedOrder(null);
    setCreatingOrder(true);
    setEditingOrder(null);
    setEditDraft({
      status: "PENDING_WHATSAPP",
      customerName: "",
      customerPhone: "",
      fulfillment: "Retiro",
      notes: "",
      items: []
    });
    setAddProductId("");
    setOpenActionsId(null);
  }

  function closeOrderEditor() {
    setCreatingOrder(false);
    setEditingOrder(null);
    setEditDraft(null);
    setAddProductId("");
    setError("");
  }

  function updateDraftItemQuantity(itemId: string | null, delta: number) {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => item.draftId === itemId ? { ...item, quantity: Math.max(0, Math.min(99, item.quantity + delta)) } : item).filter((item) => item.quantity > 0)
      };
    });
  }

  function removeDraftItem(itemId: string | null) {
    setEditDraft((current) => current ? { ...current, items: current.items.filter((item) => item.draftId !== itemId) } : current);
  }

  function updateDraftItemOptions(itemId: string, group: AdminProduct["optionGroups"][number], optionId: string, checked: boolean) {
    setEditDraft((current) => current ? {
      ...current,
      items: current.items.map((item) => {
        if (item.draftId !== itemId) return item;
        const selected = new Set(item.selectedOptionIds ?? []);
        if (group.selectionType === "SINGLE") {
          group.options.forEach((option) => selected.delete(option.id));
          if (optionId) selected.add(optionId);
        } else if (checked) {
          selected.add(optionId);
        } else {
          selected.delete(optionId);
        }
        return { ...item, selectedOptionIds: Array.from(selected) };
      })
    } : current);
  }

  function addProductToDraft() {
    if (!addProductId) {
      setError("Elegí un producto para agregar.");
      return;
    }
    const product = productsById.get(addProductId);
    if (!product) return;
    setEditDraft((current) => current ? {
      ...current,
      items: [
        ...current.items,
        {
          draftId: crypto.randomUUID(),
          id: null,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.promoPrice ?? product.basePrice,
          purchasePrice: product.purchasePrice,
          options: [],
          selectedOptionIds: []
        }
      ]
    } : current);
    setAddProductId("");
    setError("");
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!creatingOrder && !editingOrder) || !editDraft) return;
    if (creatingOrder && editDraft.items.length === 0) {
      setError("Agregá al menos un producto al pedido.");
      return;
    }

    const savingId = creatingOrder ? "new" : editingOrder!.id;
    setUpdatingId(savingId);
    setError("");
    const response = await fetch(creatingOrder ? "/api/admin/orders" : `/api/admin/orders/${editingOrder!.id}`, {
      method: creatingOrder ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editDraft,
        items: editDraft.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          ...(item.selectedOptionIds ? { selectedOptionIds: item.selectedOptionIds } : {})
        }))
      })
    });
    const data = await response.json().catch(() => null);
    setUpdatingId(null);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo guardar el pedido.");
      return;
    }

    if (creatingOrder) {
      setOrders((current) => [data.order, ...current.filter((order) => order.id !== data.order.id)]);
    } else {
      setOrders((current) => current.map((order) => (order.id === editingOrder!.id ? data.order : order)));
    }
    closeOrderEditor();
    if (creatingOrder) setSelectedOrder(data.order);
  }

  async function deleteOrder(order: OrderListItem) {
    if (!window.confirm(`¿Eliminar el pedido #${order.code}? Esta acción no se puede deshacer.`)) return;

    setDeletingId(order.id);
    setError("");
    const response = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    setDeletingId(null);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo eliminar el pedido.");
      return;
    }

    setOrders((current) => current.filter((currentOrder) => currentOrder.id !== order.id));
    setSelectedOrder((current) => (current?.id === order.id ? null : current));
    setEditingOrder((current) => (current?.id === order.id ? null : current));
  }

  function resetAdvancedFilters() {
    setDraftFilters(emptyAdvancedFilters);
    setFiltersOpen(false);
    replaceFilterParams(statusFilter, emptyAdvancedFilters);
  }

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  }

  function closeFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(false);
  }

  function applyAdvancedFilters() {
    setFiltersOpen(false);
    replaceFilterParams(statusFilter, draftFilters);
  }

  function orderCost(order: OrderListItem) {
    return calculateOrderCost(order.items);
  }

  function orderProfit(order: OrderListItem) {
    return calculateOrderProfit(order.total, order.items);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Pedidos</p>
          <p className="mt-2 text-3xl font-black">{metrics.count}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Facturación</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(metrics.paidTotal)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Costo de compra</p>
          <p className="mt-2 text-3xl font-black">{formatMoney(metrics.paidCost)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm font-bold text-muted">Ganancia</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{formatMoney(metrics.paidProfit)}</p>
        </article>
      </section>

      <section className="panel overflow-hidden">
        <div className="grid gap-3 border-b border-line p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="grid gap-2">
              <span className="text-sm font-black text-ink">Buscar pedido</span>
              <span className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  className="field !pl-11"
                  placeholder="ID, cliente o celular"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
            </label>
            <button className="btn-primary self-end !py-3" type="button" onClick={openCreateOrder}>
              <Plus size={18} /> Crear pedido
            </button>
            <button className="btn-secondary self-end !py-3" type="button" onClick={openFilters}>
              <SlidersHorizontal size={18} />
              Filtros{activeAdvancedFilters ? ` (${activeAdvancedFilters})` : ""}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => {
              const Icon = option.icon;
              const isActive = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-black ${filterBadgeClass(option.value, isActive)}`}
                  type="button"
                  onClick={() => {
                    replaceFilterParams(option.value, appliedFilters);
                  }}
                >
                  <Icon size={15} /> {option.label} ({counts[option.value]})
                </button>
              );
            })}
          </div>
          {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>

        {filteredOrders.length === 0 ? (
          <p className="p-5 text-muted">No hay pedidos para mostrar.</p>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[27%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Pedido</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Cliente</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Productos</th>
                    <th className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-[0.14em] text-muted">Total</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Estado</th>
                    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-muted">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-4 align-top">
                        <p className="font-black text-ink">#{order.code}</p>
                        <p className="mt-1 text-sm font-semibold leading-snug text-muted">{formatBuenosAiresDate(order.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black text-ink">{order.customerName}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-muted">{order.customerPhone}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <ul className="grid gap-1 text-sm font-semibold text-muted">
                          {order.items.map((item) => (
                            <li key={item.id} className="truncate">
                              <span className="font-black text-ink">{item.quantity}x</span> {item.productName}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-3 py-4 text-right align-top">
                        <p className="whitespace-nowrap text-lg font-black tracking-[-0.03em] text-ink">{formatMoney(order.total)}</p>
                        <p className="mt-1 whitespace-nowrap text-xs font-semibold text-muted">Costo: {formatMoney(orderCost(order))}</p>
                        <p className="whitespace-nowrap text-xs font-black text-emerald-700">Ganancia: {formatMoney(orderProfit(order))}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <select
                          className="field !py-2 !pl-3 !pr-8 text-sm font-bold"
                          value={order.status}
                          disabled={updatingId === order.id}
                          aria-label={`Cambiar estado del pedido ${order.code}`}
                          onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="grid gap-2">
                          {orderWhatsAppHref(order) ? (
                            <a
                              className="flex items-center justify-center gap-1.5 rounded-2xl border border-green-200 bg-green-50 px-2 py-2 text-sm font-black text-green-700"
                              href={orderWhatsAppHref(order) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir WhatsApp de ${order.customerName}`}
                              title="Abrir WhatsApp"
                            >
                              <WhatsappIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              WhatsApp
                            </a>
                          ) : null}
                          <button
                            className="btn-secondary w-full !rounded-2xl !px-2 !py-2 text-sm"
                            type="button"
                            aria-label={`Ver detalle del pedido ${order.code}`}
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye size={16} />
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 bg-surface p-3 lg:hidden">
              {filteredOrders.map((order) => (
                <article
                  key={order.id}
                  className="grid cursor-pointer overflow-hidden rounded-[28px] border border-line bg-white transition hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpenActionsId(null);
                    setSelectedOrder(order);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setOpenActionsId(null);
                      setSelectedOrder(order);
                    }
                  }}
                >
                  <div className="grid gap-4 bg-surface p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Pedido</p>
                      <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-ink">#{order.code}</p>
                      <p className="mt-1 text-sm font-bold text-muted">{formatBuenosAiresDate(order.createdAt)}</p>
                    </div>
                    <span className={`w-max rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid gap-4 border-t border-line p-5">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Cliente</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.customerName}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Celular</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.customerPhone}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Entrega</p>
                          <p className="mt-1 truncate text-sm font-black text-ink">{order.fulfillment}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Items</p>
                          <p className="mt-1 text-sm font-black text-ink">
                            {order.items.length} producto{order.items.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Productos</p>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-muted">
                        {order.items.map((item) => (
                          <li key={item.id} className="before:mr-2 before:text-brand before:content-['•']">
                            <span className="font-black text-ink">{item.quantity}x</span> {item.productName}
                            <span className="ml-1 whitespace-nowrap text-ink">{formatMoney(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  <div className="grid gap-4 border-t border-line p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Facturación</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink">{formatMoney(order.total)}</p>
                      <p className="mt-2 text-sm font-semibold text-muted">Costo: {formatMoney(orderCost(order))}</p>
                      <p className="text-sm font-black text-emerald-700">Ganancia: {formatMoney(orderProfit(order))}</p>
                    </div>
                    <div className="grid gap-2" onClick={(event) => event.stopPropagation()}>
                      {orderWhatsAppHref(order) ? (
                        <a
                          className="flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 font-black text-green-700"
                          href={orderWhatsAppHref(order) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir WhatsApp de ${order.customerName}`}
                        >
                          <WhatsappIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                          WhatsApp
                        </a>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="field !py-2.5 text-sm font-bold"
                          value={order.status}
                          disabled={updatingId === order.id}
                          aria-label={`Cambiar estado del pedido ${order.code}`}
                          onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-secondary !rounded-2xl !px-3 !py-2.5"
                          type="button"
                          aria-expanded={openActionsId === order.id}
                          aria-controls={`order-actions-${order.id}`}
                          onClick={() => setOpenActionsId((current) => current === order.id ? null : order.id)}
                        >
                          <SlidersHorizontal size={17} />
                          Acciones
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {actionOrder ? (
        <div
          className="fixed inset-0 z-[110] flex items-end bg-ink/45 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Acciones del pedido ${actionOrder.code}`}
          onClick={() => setOpenActionsId(null)}
        >
          <div className="grid w-full max-w-sm gap-3 rounded-[28px] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pedido #{actionOrder.code}</p>
                <h2 className="mt-1 text-2xl font-black">Acciones</h2>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={() => setOpenActionsId(null)} aria-label="Cerrar acciones">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                className="btn-secondary !justify-start !rounded-2xl !px-4 !py-3"
                type="button"
                onClick={() => {
                  setOpenActionsId(null);
                  setSelectedOrder(actionOrder);
                }}
              >
                <Eye size={18} /> Ver detalle
              </button>
              <button
                className="btn-secondary !justify-start !rounded-2xl !px-4 !py-3"
                type="button"
                onClick={() => openOrderEditor(actionOrder)}
              >
                <Edit2 size={18} /> Editar
              </button>
              <button
                className="btn-secondary !justify-start !rounded-2xl !px-4 !py-3 !text-red-600"
                type="button"
                disabled={deletingId === actionOrder.id}
                onClick={() => {
                  setOpenActionsId(null);
                  void deleteOrder(actionOrder);
                }}
              >
                <Trash2 size={18} /> {deletingId === actionOrder.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Filtrar pedidos">
          <div className="grid max-h-[92dvh] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Filtros</p>
                <h2 className="mt-1 text-2xl font-black">Filtrar pedidos</h2>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={closeFilters} aria-label="Cerrar filtros">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 overflow-y-auto overscroll-contain pb-6 pr-1">
              <fieldset className="grid gap-3">
                <legend className="font-black">Tiempo</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {timeFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`rounded-2xl border px-3 py-3 text-sm font-black ${
                        draftFilters.timeFilter === option.value ? "border-brand bg-brand/10 text-brand" : "border-line bg-white text-ink"
                      }`}
                      type="button"
                      onClick={() => setDraftFilters((current) => ({ ...current, timeFilter: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {draftFilters.timeFilter === "custom" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Fecha inicio</span>
                    <input
                      className="field"
                      type="date"
                      value={draftFilters.customFrom}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, customFrom: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Fecha fin</span>
                    <input
                      className="field"
                      type="date"
                      value={draftFilters.customTo}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, customTo: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <PriceFilterInput
                  label="Precio mínimo"
                  placeholder="0"
                  value={draftFilters.priceMin}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, priceMin: value }))}
                />
                <PriceFilterInput
                  label="Precio máximo"
                  placeholder="50.000"
                  value={draftFilters.priceMax}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, priceMax: value }))}
                />
              </div>
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="btn-secondary w-full" type="button" onClick={resetAdvancedFilters}>
                  Limpiar
                </button>
                <button className="btn-primary w-full" type="button" onClick={applyAdvancedFilters}>
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-[100] flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Detalle del pedido">
          <div className="grid max-h-[92dvh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pedido</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black">#{selectedOrder.code}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusBadgeClass(selectedOrder.status)}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{formatBuenosAiresDate(selectedOrder.createdAt)}</p>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={() => setSelectedOrder(null)} aria-label="Cerrar detalle">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain pb-6 pr-1">
              <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Cliente</p>
                  <p className="mt-1 truncate font-black">{selectedOrder.customerName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Celular</p>
                    <p className="mt-1 truncate font-black">{selectedOrder.customerPhone}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Entrega</p>
                    <p className="mt-1 truncate font-black">{selectedOrder.fulfillment}</p>
                  </div>
                </div>
                {selectedOrder.notes ? (
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Dirección o indicaciones</p>
                    <p className="mt-1 whitespace-pre-wrap font-semibold">{selectedOrder.notes}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 divide-y divide-line rounded-3xl border border-line">
                {selectedOrder.items.map((item) => {
                  const options = normalizeOrderOptions(item.options);
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {item.quantity}x {item.productName}
                          </p>
                          <p className="mt-1 text-sm text-muted">Venta unit.: {formatMoney(item.unitPrice)}</p>
                          <p className="text-sm text-muted">Compra unit.: {formatMoney(item.purchasePrice)}</p>
                        </div>
                        <p className="shrink-0 font-black">{formatMoney(item.subtotal)}</p>
                      </div>
                      {options.length ? (
                        <ul className="mt-3 space-y-1 text-sm text-muted">
                          {options.map((option, index) => (
                            <li key={`${item.id}-${index}`}>
                              {option.groupName ? `${option.groupName}: ` : ""}
                              {option.optionName}
                              {option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-2xl font-black">Facturación: {formatMoney(selectedOrder.total)}</p>
                  <p className="mt-1 text-sm font-semibold text-muted">Costo: {formatMoney(orderCost(selectedOrder))}</p>
                  <p className="text-sm font-black text-emerald-700">Ganancia: {formatMoney(orderProfit(selectedOrder))}</p>
                </div>
                <button className="btn-primary sm:min-w-52" type="button" onClick={() => printOrder(selectedOrder)}>
                  <Printer size={18} /> Imprimir pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {(creatingOrder || editingOrder) && editDraft ? (
        <div className="fixed inset-0 z-[100] flex items-end overflow-hidden bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={creatingOrder ? "Crear pedido" : "Editar pedido"}>
          <form
            className="grid max-h-[92dvh] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:rounded-[32px] sm:p-6"
            onSubmit={saveOrder}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{creatingOrder ? "Nuevo pedido" : `Pedido #${editingOrder?.code}`}</p>
                <h2 className="mt-1 text-2xl font-black">{creatingOrder ? "Crear pedido" : "Editar pedido"}</h2>
              </div>
              <button className="btn-secondary !h-11 !w-11 !p-0" type="button" onClick={closeOrderEditor} aria-label="Cerrar edición">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto overscroll-contain pb-6 pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Nombre del cliente</span>
                  <input
                    className="field"
                    value={editDraft.customerName}
                    onChange={(event) => setEditDraft((current) => current ? { ...current, customerName: event.target.value } : current)}
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-black">Teléfono</span>
                  <input
                    className="field"
                    inputMode="tel"
                    value={editDraft.customerPhone}
                    onChange={(event) => setEditDraft((current) => current ? { ...current, customerPhone: event.target.value } : current)}
                    autoComplete="tel"
                    maxLength={40}
                    required
                  />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-black">Modalidad</span>
                <select
                  className="field"
                  value={editDraft.fulfillment}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, fulfillment: event.target.value } : current)}
                >
                  <option>Retiro</option>
                  <option>Delivery</option>
                  <option>Coordinar por WhatsApp</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black">Dirección o indicaciones <span className="font-semibold text-muted">(opcional)</span></span>
                <textarea
                  className="field min-h-24 resize-y"
                  maxLength={500}
                  value={editDraft.notes}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, notes: event.target.value } : current)}
                  placeholder="Dirección de entrega u otra información útil"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black">Estado</span>
                <select
                  className="field"
                  value={editDraft.status}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, status: event.target.value as OrderStatus } : current)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <section className="grid gap-3 rounded-3xl border border-line p-4">
                <div>
                  <p className="text-sm font-black">Productos del pedido</p>
                  <p className="mt-1 text-xs font-semibold text-muted">Podés cambiar cantidades, quitar productos o agregar otros.</p>
                </div>
                <div className="grid gap-2">
                  {editDraft.items.length === 0 ? <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-muted">Todavía no agregaste productos.</p> : null}
                  {editDraft.items.map((item) => {
                    const product = item.productId ? productsById.get(item.productId) : undefined;
                    const unitPrice = draftItemUnitPrice(item, productsById);
                    return (
                      <div key={item.draftId} className="grid gap-3 rounded-2xl bg-surface p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black">{item.productName}</p>
                            <p className="mt-1 text-sm font-semibold text-muted">{formatMoney(unitPrice)} c/u · {formatMoney(unitPrice * item.quantity)}</p>
                          </div>
                          <button
                            className="rounded-full p-2 text-red-600 hover:bg-red-50"
                            type="button"
                            aria-label={`Quitar ${item.productName}`}
                            onClick={() => removeDraftItem(item.draftId)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-muted">Cantidad</span>
                          <div className="flex items-center gap-3">
                            <button
                              className="rounded-full border border-line bg-white p-2"
                              type="button"
                              aria-label={`Disminuir cantidad de ${item.productName}`}
                              onClick={() => updateDraftItemQuantity(item.draftId, -1)}
                            >
                              −
                            </button>
                            <span className="min-w-5 text-center font-black">{item.quantity}</span>
                            <button
                              className="rounded-full border border-line bg-white p-2"
                              type="button"
                              aria-label={`Aumentar cantidad de ${item.productName}`}
                              disabled={item.quantity >= 99}
                              onClick={() => updateDraftItemQuantity(item.draftId, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {item.id === null && product?.optionGroups.length ? (
                          <div className="grid gap-3 border-t border-line pt-3">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Variantes</p>
                            {product.optionGroups.map((group) => {
                              const selectedIds = item.selectedOptionIds ?? [];
                              const selectedInGroup = selectedIds.find((id) => group.options.some((option) => option.id === id)) ?? "";
                              return (
                                <fieldset key={group.id} className="grid gap-2">
                                  <legend className="text-sm font-black">{group.name}{group.isRequired ? " *" : ""}</legend>
                                  {group.selectionType === "SINGLE" ? (
                                    <select
                                      className="field !py-2.5 text-sm"
                                      value={selectedInGroup}
                                      onChange={(event) => updateDraftItemOptions(item.draftId, group, event.target.value, true)}
                                    >
                                      {!group.isRequired ? <option value="">Sin selección</option> : null}
                                      {group.options.filter((option) => option.isAvailable).map((option) => (
                                        <option key={option.id} value={option.id}>{option.name}{option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="grid gap-2">
                                      {group.options.filter((option) => option.isAvailable).map((option) => (
                                        <label key={option.id} className="flex items-center gap-2 text-sm font-semibold">
                                          <input
                                            type="checkbox"
                                            checked={selectedIds.includes(option.id)}
                                            onChange={(event) => updateDraftItemOptions(item.draftId, group, option.id, event.target.checked)}
                                          />
                                          {option.name}{option.priceDelta ? ` · ${formatMoney(option.priceDelta)}` : ""}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </fieldset>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select className="field" value={addProductId} onChange={(event) => setAddProductId(event.target.value)}>
                    <option value="">Agregar producto...</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <button className="btn-secondary" type="button" onClick={addProductToDraft}>
                    Agregar
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="font-black">Nuevo total estimado</span>
                  <span className="text-xl font-black">{formatMoney(editDraft.items.reduce((sum, item) => sum + draftItemUnitPrice(item, productsById) * item.quantity, 0))}</span>
                </div>
              </section>
              {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
            </div>

            <div className="-mx-5 -mb-5 border-t border-line bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="btn-secondary w-full" type="button" onClick={closeOrderEditor}>Cancelar</button>
                <button className="btn-primary w-full" type="submit" disabled={updatingId === (creatingOrder ? "new" : editingOrder?.id)}>
                  {creatingOrder ? <Plus size={18} /> : <Edit2 size={18} />}
                  {updatingId === (creatingOrder ? "new" : editingOrder?.id) ? "Guardando..." : creatingOrder ? "Crear pedido" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
