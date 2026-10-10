import type { FinancialBreakdown } from './quote-finance';

type CommercialOrder = {
  status: string;
  amount_cents: number;
  financialBreakdown: FinancialBreakdown;
};

type ProductSaleItem = {
  quantity: number;
  cost_cents: number;
};

type ProductSale = {
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  product_sale_items: ProductSaleItem[];
};

const number = (value: unknown) => Number(value ?? 0) || 0;

export function summarizeCommercialResults(orders: CommercialOrder[], sales: ProductSale[]) {
  const completedOrders = orders.filter(order => order.status === 'Concluído');
  const confirmedSales = sales.filter(sale => sale.status === 'confirmed');
  const orderBreakdowns = completedOrders.map(order => order.financialBreakdown);

  const orderProductQuantity = orderBreakdowns.reduce((sum, item) => sum + item.partsQuantity, 0);
  const orderProductRevenueCents = orderBreakdowns.reduce((sum, item) => sum + item.partsCents, 0);
  const orderProductCostCents = orderBreakdowns.reduce((sum, item) => sum + item.partsCostCents, 0);
  const orderProductCostComplete = orderBreakdowns.every(item => item.partsMarginCents != null);
  const serviceQuantity = orderBreakdowns.reduce((sum, item) => sum + item.laborQuantity, 0);
  const serviceItemCount = orderBreakdowns.reduce((sum, item) => sum + item.laborItemCount, 0);
  const serviceRevenueCents = orderBreakdowns.reduce((sum, item) => sum + item.laborCents, 0);
  const unclassifiedRevenueCents = orderBreakdowns.reduce((sum, item) => sum + item.unclassifiedCents, 0);
  const orderDiscountCents = orderBreakdowns.reduce((sum, item) => sum + item.partsDiscountCents + item.laborDiscountCents + item.unclassifiedDiscountCents, 0);
  const completedOrderRevenueCents = completedOrders.reduce((sum, order) => sum + number(order.amount_cents), 0);

  const directProductQuantity = confirmedSales.reduce((sum, sale) => sum + sale.product_sale_items.reduce((itemSum, item) => itemSum + number(item.quantity), 0), 0);
  const directProductCostCents = confirmedSales.reduce((sum, sale) => sum + sale.product_sale_items.reduce((itemSum, item) => itemSum + Math.round(number(item.quantity) * number(item.cost_cents)), 0), 0);
  const directProductRevenueCents = confirmedSales.reduce((sum, sale) => sum + number(sale.total_cents), 0);
  const directProductGrossCents = confirmedSales.reduce((sum, sale) => sum + number(sale.subtotal_cents), 0);
  const directProductDiscountCents = confirmedSales.reduce((sum, sale) => sum + number(sale.discount_cents), 0);

  const productRevenueCents = directProductRevenueCents + orderProductRevenueCents;
  const productCostCents = directProductCostCents + orderProductCostCents;
  const netRevenueCents = directProductRevenueCents + completedOrderRevenueCents;
  const grossRevenueCents = directProductGrossCents + completedOrderRevenueCents + orderDiscountCents;
  const discountCents = directProductDiscountCents + orderDiscountCents;
  const transactionCount = confirmedSales.length + completedOrders.length;

  return {
    directSaleCount: confirmedSales.length,
    completedOrderCount: completedOrders.length,
    transactionCount,
    directProductQuantity,
    orderProductQuantity,
    productQuantity: directProductQuantity + orderProductQuantity,
    directProductRevenueCents,
    orderProductRevenueCents,
    productRevenueCents,
    productCostCents,
    productMarginCents: orderProductCostComplete ? productRevenueCents - productCostCents : null,
    serviceQuantity,
    serviceItemCount,
    serviceRevenueCents,
    unclassifiedRevenueCents,
    grossRevenueCents,
    discountCents,
    netRevenueCents,
    averageTicketCents: transactionCount ? Math.round(netRevenueCents / transactionCount) : 0,
  };
}
