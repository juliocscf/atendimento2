// Item classification is additive: historical items remain unclassified.
export type QuoteItemType = 'part' | 'labor' | 'unclassified';
export type FinancialItem = { item_type?: QuoteItemType; quantity: number; total_cents: number; unit_cost_cents?: number | null };
export type FinancialBreakdown = {
  partsCents: number; laborCents: number; unclassifiedCents: number;
  partsCostCents: number; partsMarginCents: number | null; missingCostItems: number;
  partsQuantity: number; laborQuantity: number; unclassifiedQuantity: number;
  partsItemCount: number; laborItemCount: number; unclassifiedItemCount: number;
  partsDiscountCents: number; laborDiscountCents: number; unclassifiedDiscountCents: number;
  totalCents: number; category: string;
};
export const itemTypeLabels: Record<QuoteItemType, string> = { part: 'Peça', labor: 'Mão de obra', unclassified: 'Não classificado' };

// Allocate whole cents by largest remainder so categories always reconcile.
export function financialBreakdown(items: FinancialItem[], discountCents = 0): FinancialBreakdown {
  const gross = [0, 0, 0];
  const quantities = [0, 0, 0];
  const itemCounts = [0, 0, 0];
  let partsCostCents = 0;
  let missingCostItems = 0;
  for (const item of items) {
    const index = item.item_type === 'part' ? 0 : item.item_type === 'labor' ? 1 : 2;
    gross[index] += item.total_cents;
    quantities[index] += Number(item.quantity) || 0;
    itemCounts[index]++;
    if (index === 0) {
      if (item.unit_cost_cents == null) missingCostItems++;
      else partsCostCents += Math.round(Number(item.quantity) * item.unit_cost_cents);
    }
  }
  const subtotal = gross.reduce((sum, value) => sum + value, 0);
  const discount = Math.min(subtotal, Math.max(0, Math.round(discountCents)));
  const raw = gross.map(value => subtotal ? discount * value / subtotal : 0);
  const allocated = raw.map(Math.floor);
  const priority = raw.map((value, index) => ({ index, fraction: value - allocated[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remaining = discount - allocated.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remaining; i++) allocated[priority[i].index]++;
  const [partsCents, laborCents, unclassifiedCents] = gross.map((value, index) => value - allocated[index]);
  const hasParts = items.some(item => item.item_type === 'part');
  const hasLabor = items.some(item => item.item_type === 'labor');
  const hasUnclassified = items.some(item => !item.item_type || item.item_type === 'unclassified');
  return { partsCents, laborCents, unclassifiedCents, partsCostCents,
    partsMarginCents: missingCostItems ? null : partsCents - partsCostCents,
    missingCostItems, partsDiscountCents: allocated[0], laborDiscountCents: allocated[1], unclassifiedDiscountCents: allocated[2],
    partsQuantity: quantities[0], laborQuantity: quantities[1], unclassifiedQuantity: quantities[2],
    partsItemCount: itemCounts[0], laborItemCount: itemCounts[1], unclassifiedItemCount: itemCounts[2],
    totalCents: subtotal - discount,
    category: hasUnclassified ? 'Classificação pendente' : hasParts && hasLabor ? 'Peças com mão de obra' : hasParts ? 'Somente peças' : hasLabor ? 'Somente mão de obra' : 'Sem itens' };
}

export function unclassifiedBreakdown(totalCents: number): FinancialBreakdown {
  return financialBreakdown(totalCents ? [{ quantity: 1, total_cents: totalCents }] : []);
}
