import { money } from '@/lib/demo';
import { type FinancialBreakdown } from '@/lib/quote-finance';

export function FinancialSummary({ breakdown }: { breakdown: FinancialBreakdown }) {
  return <div className="financial-summary" aria-label="Composição interna do valor">
    <b>{breakdown.category}</b>
    <div><span>Peças</span><strong>{money(breakdown.partsCents)}</strong></div>
    <div><span>Mão de obra</span><strong>{money(breakdown.laborCents)}</strong></div>
    {breakdown.unclassifiedCents > 0 && <div><span>Não classificado</span><strong>{money(breakdown.unclassifiedCents)}</strong></div>}
    <div><span>Custo das peças informado</span><strong>{money(breakdown.partsCostCents)}</strong></div>
    <div><span>Margem das peças</span><strong>{breakdown.partsMarginCents == null ? 'Custo pendente' : money(breakdown.partsMarginCents)}</strong></div>
    <small>Controle interno · valores de venda após desconto proporcional. A margem das peças considera apenas o custo de compra.</small>
    {breakdown.missingCostItems > 0 && <small>{breakdown.missingCostItems} item(ns) de peça sem custo informado.</small>}
  </div>;
}
