import { normalizeIntlWhitespace } from "@/lib/formatting";

export function formatMoney(cents: number) {
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(cents);

  return normalizeIntlWhitespace(formatted);
}

export function parsePriceToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "0")
    .replace(/\s/g, "")
    .replace(/^\$/, "")
    .trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
}
