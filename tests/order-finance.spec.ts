import { expect, test } from '@playwright/test';
import { isFinanciallyValid, orderBalance, orderFinancialSnapshot, summarizeOrderFinance } from '../lib/order-finance';

test('concilia canceladas, anuladas e concluídas com saldo sem apagar recebimentos', () => {
  const orders = [
    { status: 'Em execução', amount: 12100, paid: 0 },
    { status: 'Concluído', amount: 39000, paid: 39000 },
    { status: 'Concluído', amount: 6000, paid: 0 },
    { status: 'Concluído', amount: 12000, paid: 12000 },
    { status: 'Cancelada', amount: 144500, paid: 10000 },
    { status: 'Anulada', amount: 51000, paid: 51000 },
  ];
  const copy = structuredClone(orders);
  expect(summarizeOrderFinance(orders)).toEqual({ amount: 69100, received: 51000, balance: 18100, excludedReceived: 61000, excludedCount: 2 });
  expect(orders).toEqual(copy);
  expect(orders.filter(order => orderBalance(order) > 0)).toHaveLength(2);
  expect(orders.filter(order => isFinanciallyValid(order.status))).toHaveLength(4);
});

test('saldo excedente de uma OS não abate dívida de outra', () => {
  expect(summarizeOrderFinance([
    { status: 'Concluído', amount: 10000, paid: 12000 },
    { status: 'Em execução', amount: 5000, paid: 0 },
  ]).balance).toBe(5000);
  expect(summarizeOrderFinance([]).balance).toBe(0);
});

test('usa uma única versão aprovada com desconto e ignora rascunho e proposta enviada', () => {
  const items = [{ item_type: 'part' as const, quantity: 1, total_cents: 10000, unit_cost_cents: 4000 }, { item_type: 'labor' as const, quantity: 1, total_cents: 10000 }];
  const quote = (version: number, status: string) => ({ version, status, total_cents: 18000, discount_cents: 2000, quote_items: items });
  const result = orderFinancialSnapshot({ amount_cents: 0, quotes: [quote(1, 'approved'), quote(3, 'sent'), quote(2, 'approved'), quote(4, 'draft')] });
  expect(result.amount_cents).toBe(18000);
  expect(result.financialBreakdown).toMatchObject({ partsCents: 9000, laborCents: 9000, partsMarginCents: 5000 });
  expect(orderFinancialSnapshot({ amount_cents: 0, quotes: [quote(1, 'sent')] }).amount_cents).toBe(0);
});

test('dados históricos sem itens são preservados e custo ausente não produz lucro fictício', () => {
  expect(orderFinancialSnapshot({ amount_cents: 12000, quotes: [] }).financialBreakdown.unclassifiedCents).toBe(12000);
  const result = orderFinancialSnapshot({ amount_cents: 12100, quotes: [{ version: 1, status: 'approved', total_cents: 12100, discount_cents: 0, quote_items: [{ item_type: 'part', quantity: 1, total_cents: 12100, unit_cost_cents: null }] }] });
  expect(result.financialBreakdown.partsMarginCents).toBeNull();
});
