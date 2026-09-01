import { normalizeIntlWhitespace } from "@/lib/formatting";

const argentinaTimeZone = "America/Argentina/Buenos_Aires";

export function formatBuenosAiresDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat("es-AR", {
    timeZone: argentinaTimeZone,
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);

  return normalizeIntlWhitespace(formatted);
}
