'use client';

import { Archive, ChevronRight, FileText } from 'lucide-react';
import { isFinanciallyValid } from '@/lib/order-finance';
import { dateLabel, money, type DemoData, type Order } from '@/lib/demo';

type QuoteSummary = {
  id: string;
  serviceOrderId: string;
  version: number;
  status: string;
  totalCents: number;
  validUntil: string | null;
};

type Props = {
  data: DemoData;
  clientName: (id: string) => string;
  quotesOverride?: QuoteSummary[] | null;
  onOrder: (order: Order) => void;
  notify: (message: string, error?: boolean) => void;
  onNew?: () => void;
};

const quoteStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando cliente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  expired: 'Expirado',
};

function latestQuotePerOrder(quotes: QuoteSummary[]) {
  return [...quotes]
    .sort((a, b) => b.version - a.version)
    .filter((quote, index, all) => all.findIndex(item => item.serviceOrderId === quote.serviceOrderId) === index);
}

function statusLabel(status: string) {
  return quoteStatusLabels[status] ?? status;
}

export function QuotesViewLifecycle({ data, clientName, quotesOverride, onOrder, notify, onNew }: Props) {
  const live = quotesOverride !== null && quotesOverride !== undefined;
  const ordersById = new Map(data.orders.map(order => [order.id, order]));
  const demoQuotes: QuoteSummary[] = data.orders
    .filter(order => ['Aguardando aprovação', 'Em execução', 'Concluído'].includes(order.status))
    .map(order => ({ id: order.id, serviceOrderId: order.id, version: 1, status: order.status === 'Aguardando aprovação' ? 'sent' : 'approved', totalCents: order.amount, validUntil: null }));
  const latestQuotes = latestQuotePerOrder(live ? quotesOverride ?? [] : demoQuotes);
  const validQuotes = latestQuotes.filter(quote => {
    const order = ordersById.get(quote.serviceOrderId);
    return order ? isFinanciallyValid(order.status) : false;
  });
  const archivedQuotes = latestQuotes.filter(quote => {
    const order = ordersById.get(quote.serviceOrderId);
    return Boolean(order && !isFinanciallyValid(order.status));
  });
  const activeQuotes = validQuotes.filter(quote => !['rejected', 'expired'].includes(quote.status));
  const approvalCount = validQuotes.filter(quote => quote.status === 'sent').length;
  const approvedCount = validQuotes.filter(quote => quote.status === 'approved').length;
  const decidedCount = validQuotes.filter(quote => ['approved', 'rejected', 'expired'].includes(quote.status)).length;
  const approvalRate = decidedCount ? Math.round((approvedCount / decidedCount) * 100) : null;
  const proposedTotal = activeQuotes.reduce((sum, quote) => sum + quote.totalCents, 0);

  return <div className="view-stack">
    <div className="quote-summary">
      <div><span>Em aprovação</span><b>{approvalCount}</b><small>aguardando retorno do cliente</small></div>
      <div><span>Valor de propostas válidas</span><b>{money(proposedTotal)}</b><small>{validQuotes.length} OS válidas · versões atuais</small></div>
      <div><span>Taxa de aprovação</span><b>{approvalRate == null ? '—' : `${approvalRate}%`}</b><small>{approvedCount} aprovados · {archivedQuotes.length} arquivados</small></div>
    </div>

    <QuoteList
      title="Propostas atuais"
      subtitle="Uma versão atual por OS válida"
      quotes={validQuotes}
      ordersById={ordersById}
      clientName={clientName}
      onOrder={onOrder}
      notify={notify}
      onNew={onNew}
    />

    {archivedQuotes.length > 0 && <QuoteList
      title="Histórico arquivado"
      subtitle="Propostas preservadas de OS canceladas ou anuladas"
      quotes={archivedQuotes}
      ordersById={ordersById}
      clientName={clientName}
      onOrder={onOrder}
      notify={notify}
      archived
    />}
  </div>;
}

function QuoteList({ title, subtitle, quotes, ordersById, clientName, onOrder, notify, onNew, archived = false }: {
  title: string;
  subtitle: string;
  quotes: QuoteSummary[];
  ordersById: Map<string, Order>;
  clientName: (id: string) => string;
  onOrder: (order: Order) => void;
  notify: (message: string, error?: boolean) => void;
  onNew?: () => void;
  archived?: boolean;
}) {
  return <section className={`panel full-panel ${archived ? 'quote-archive-panel' : ''}`}>
    <div className="panel-header"><div><h3>{archived && <Archive size={15} />} {title}</h3><span>{subtitle}</span></div>{!archived && <button className="panel-link" onClick={onNew}>Novo orçamento <ChevronRight size={15} /></button>}</div>
    <div className="quote-list">
      {quotes.length ? quotes.map(quote => {
        const order = ordersById.get(quote.serviceOrderId);
        if (!order) return null;
        const linkEnabled = !archived && quote.status === 'sent';
        return <div className={`quote-row ${archived ? 'quote-row-archived' : ''}`} key={quote.id}>
          <button className="quote-main-action" onClick={() => onOrder(order)}>
            <span className="quote-icon"><FileText size={18} /></span>
            <span className="quote-main"><b>{order.number}</b><strong>{clientName(order.clientId)}</strong><small>Versão {quote.version} · {archived ? `OS ${order.status.toLowerCase()}` : quote.validUntil ? 'válida até ' + dateLabel(quote.validUntil) : 'sem validade definida'}</small></span>
            <span className="quote-value"><b>{money(quote.totalCents)}</b><small>valor total</small></span>
            <span className={`status-pill ${archived ? 'status-neutral' : 'status-orange'}`}><span className="status-dot" />{archived ? 'Arquivada' : statusLabel(quote.status)}</span>
          </button>
          <PortalLinkAction quoteId={quote.id} enabled={linkEnabled} notify={notify} />
        </div>;
      }) : <p className="quote-empty">Nenhuma proposta encontrada.</p>}
    </div>
  </section>;
}

function PortalLinkAction({ quoteId, enabled, notify }: { quoteId: string; enabled: boolean; notify: (message: string, error?: boolean) => void }) {
  async function createLink() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/portal-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresInDays: 7 }) });
      const result = await response.json() as { data?: { url: string }; error?: string };
      if (!response.ok || !result.data?.url) return notify(result.error ?? 'Não foi possível gerar o link do portal.', true);
      await navigator.clipboard.writeText(result.data.url);
      notify('Link de aprovação copiado para a área de transferência.');
    } catch { notify('Não foi possível gerar o link do portal.', true); }
  }
  return <button className="button secondary compact" type="button" disabled={!enabled} onClick={event => { event.stopPropagation(); void createLink(); }}>{enabled ? 'Copiar link' : 'Link indisponível'}</button>;
}
