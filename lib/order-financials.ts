export type FinancialOrderItem = {
  quantity: number;
  purchasePrice: number;
};

export function isRevenueStatus(status: string) {
  return status === "PAID" || status === "DELIVERED";
}

export function calculateOrderCost(items: FinancialOrderItem[]) {
  return items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0);
}

export function calculateOrderProfit(total: number, items: FinancialOrderItem[]) {
  return total - calculateOrderCost(items);
}
