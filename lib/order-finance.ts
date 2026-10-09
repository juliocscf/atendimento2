import { financialBreakdown, unclassifiedBreakdown, type FinancialItem } from './quote-finance';

// Operational completion does not settle a debt. Cancellation/annulment does
// exclude the order from commercial totals, but never erases recorded receipts.
export function isFinanciallyValid(status: string) {
  return status !== 'Cancelada' && status !== 'Anulada';
}

export type FinancialOrder = { status: string; amount: number; paid: number };

export function orderBalance(order: FinancialOrder) {
  return isFinanciallyValid(order.status) ? Math.max(0, order.amount - order.paid) : 0;
}

export function summarizeOrderFinance(orders: FinancialOrder[]) {
  return orders.reduce((total, order) => {
    if (isFinanciallyValid(order.status)) {
      total.amount += order.amount;
      total.received += order.paid;
      total.balance += orderBalance(order);
    } else {
      total.excludedReceived += order.paid;
      total.excludedCount++;
    }
    return total;
  }, { amount: 0, received: 0, balance: 0, excludedReceived: 0, excludedCount: 0 });
}

type Quote = { version: number; status: string; total_cents: number; discount_cents: number; quote_items: FinancialItem[] };
export function orderFinancialSnapshot(order: { amount_cents: number; quotes: Quote[] }) {
  const quote = order.quotes.filter(item => item.status === 'approved').sort((a, b) => b.version - a.version)[0];
  const amount = quote?.total_cents ?? order.amount_cents;
  const breakdown = quote ? financialBreakdown(quote.quote_items, quote.discount_cents) : null;
  return { amount_cents: amount, financialBreakdown: breakdown?.totalCents === amount ? breakdown : unclassifiedBreakdown(amount) };
}
