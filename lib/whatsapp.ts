import { formatMoney } from "@/lib/money";

type WhatsAppOrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  options: Array<{ groupName: string; optionName: string; priceDelta: number }>;
};

export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function buildWhatsAppOrderUrl(input: {
  phone: string;
  storeName: string;
  code: string;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  address?: string | null;
  items: WhatsAppOrderItem[];
  total: number;
}) {
  const lines = [
    `Hola ${input.storeName}, quiero confirmar el pedido #${input.code}`,
    "",
    `Cliente: ${input.customerName}`,
    `Teléfono: ${input.customerPhone}`,
    `Modalidad: ${input.fulfillment}`,
    input.address ? `Dirección: ${input.address}` : null,
    "",
    "Pedido:",
    ...input.items.flatMap((item) => [
      `- ${item.quantity}x ${item.productName} (${formatMoney(item.unitPrice)})`,
      ...item.options.map((option) => {
        const delta = option.priceDelta ? ` +${formatMoney(option.priceDelta)}` : "";
        return `  • ${option.groupName}: ${option.optionName}${delta}`;
      }),
      `  Subtotal: ${formatMoney(item.subtotal)}`
    ]),
    "",
    `Total: ${formatMoney(input.total)}`
  ].filter(Boolean);

  return `https://wa.me/${normalizeWhatsAppPhone(input.phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
}
