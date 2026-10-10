import { expect, test } from '@playwright/test';
import { financialBreakdown } from '../lib/quote-finance';
import { summarizeCommercialResults } from '../lib/report-metrics';

test('separa produtos e serviços realizados e exclui cancelamentos e devoluções', () => {
  const completed = {
    status: 'Concluído',
    amount_cents: 45000,
    financialBreakdown: financialBreakdown([
      { item_type: 'part' as const, quantity: 2, total_cents: 30000, unit_cost_cents: 10000 },
      { item_type: 'labor' as const, quantity: 1, total_cents: 20000 },
    ], 5000),
  };
  const cancelled = { ...completed, status: 'Cancelada', amount_cents: 99900 };
  const confirmedSale = {
    status: 'confirmed', subtotal_cents: 25000, discount_cents: 5000, total_cents: 20000,
    product_sale_items: [{ quantity: 3, cost_cents: 4000 }],
  };
  const returnedSale = { ...confirmedSale, status: 'returned', total_cents: 80000 };

  expect(summarizeCommercialResults([completed, cancelled], [confirmedSale, returnedSale])).toEqual({
    directSaleCount: 1, completedOrderCount: 1, transactionCount: 2,
    directProductQuantity: 3, orderProductQuantity: 2, productQuantity: 5,
    directProductRevenueCents: 20000, orderProductRevenueCents: 27000, productRevenueCents: 47000,
    productCostCents: 32000, productMarginCents: 15000,
    serviceQuantity: 1, serviceItemCount: 1, serviceRevenueCents: 18000,
    unclassifiedRevenueCents: 0, grossRevenueCents: 75000, discountCents: 10000,
    netRevenueCents: 65000, averageTicketCents: 32500,
  });
});

test('não inventa margem quando uma peça da OS está sem custo', () => {
  const result = summarizeCommercialResults([{
    status: 'Concluído', amount_cents: 10000,
    financialBreakdown: financialBreakdown([{ item_type: 'part', quantity: 1, total_cents: 10000, unit_cost_cents: null }]),
  }], []);
  expect(result.productQuantity).toBe(1);
  expect(result.productRevenueCents).toBe(10000);
  expect(result.productMarginCents).toBeNull();
});
