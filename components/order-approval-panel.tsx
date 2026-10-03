'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCopy, FileText, RefreshCw } from 'lucide-react';
import { money, type Order } from '@/lib/demo';
import { financialBreakdown, itemTypeLabels, type FinancialItem } from '@/lib/quote-finance';
import { FinancialSummary } from '@/components/financial-summary';

type Quote = {
  id: string;
  version: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  notes: string | null;
  valid_until: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  items: Array<FinancialItem & { id: string; description: string; unit_price_cents: number }>;
};

export function OrderApprovalPanel({ order, liveMode, onCreateQuote, onAdvance, notify }: {
  order: Order;
  liveMode: boolean;
  onCreateQuote: () => void;
  onAdvance: (note?: string) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(liveMode);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [error, setError] = useState('');
  const awaiting = order.status === 'Aguardando aprovação';

  const refresh = useCallback(async () => {
    if (!liveMode) return;
    setLoading(true); setError('');
    try {
      const listResponse = await fetch(`/api/quotes?serviceOrderId=${encodeURIComponent(order.id)}`);
      if (!listResponse.ok) throw new Error('Não foi possível consultar o orçamento.');
      const list = await listResponse.json() as { data?: Array<{ id: string }> };
      if (!list.data?.length) { setQuote(null); return; }
      const detailResponse = await fetch(`/api/quotes/${list.data[0].id}`);
      if (!detailResponse.ok) throw new Error('Não foi possível carregar os itens da proposta.');
      const detail = await detailResponse.json() as { data: Quote };
      setQuote(detail.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a proposta.'); }
    finally { setLoading(false); }
  }, [liveMode, order.id]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function markReady() {
    if (!quote || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent' }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível finalizar a proposta.', true);
      await refresh();
      notify('Proposta finalizada. Gere o link e envie ao cliente.');
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setBusy(false); }
  }

  async function createLink() {
    if (!quote || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id}/portal-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresInDays: 7 }) });
      const result = await response.json() as { data?: { url: string }; error?: string };
      if (!response.ok || !result.data?.url) return notify(result.error ?? 'Não foi possível gerar o link.', true);
      setLink(result.data.url);
      notify('Link de aprovação gerado. Copie e envie ao cliente.');
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); notify('Link copiado. Envie ao cliente pelo canal de sua preferência.'); }
    catch { notify('Selecione e copie o link mostrado na tela.', true); }
  }

  return <section className="approval-panel" aria-label="Próximo passo da ordem de serviço">
    <div className="section-label"><FileText size={16} /> {awaiting ? 'Aprovação do cliente' : 'Diagnóstico e proposta'}</div>
    {!liveMode && <div className="approval-guidance"><p>Na demonstração, esta etapa é ilustrativa. A proposta e a aprovação reais ficam disponíveis quando a unidade está conectada.</p><button className="button secondary" onClick={() => onAdvance()}>Avançar etapa da demonstração</button></div>}
    {loading && <p>Consultando proposta…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => void refresh()}>Tentar novamente</button></p>}
    {liveMode && !loading && !quote && <div className="approval-guidance">
      <b>{awaiting ? 'Ainda não há proposta para o cliente aprovar' : 'O que foi encontrado no diagnóstico?'}</b>
      <p>Prepare um orçamento com o serviço ou peça proposta, o valor e as condições. O cliente verá esses dados antes de autorizar.</p>
      <button className="button primary" onClick={onCreateQuote}>Preparar orçamento</button>
    </div>}
    {quote && <div className="approval-quote"><div className="approval-quote-head"><b>Orçamento v{quote.version}</b><span>{quote.status === 'draft' ? 'Rascunho' : quote.status === 'sent' ? awaiting ? 'Aguardando cliente' : 'Pronto para envio' : quote.status === 'approved' ? 'Aprovado' : 'Requer revisão'}</span></div>
      <p>O cliente receberá o problema informado, o equipamento e os itens abaixo para decidir se autoriza o serviço.</p>
      {quote.items.map(item => <div className="approval-item" key={item.id}><span>{item.description}<small>{itemTypeLabels[item.item_type ?? 'unclassified']} · {item.quantity} × {money(item.unit_price_cents)}</small></span><b>{money(item.total_cents)}</b></div>)}
      <FinancialSummary breakdown={financialBreakdown(quote.items, quote.discount_cents)} />
      {quote.notes && <p><b>Condições:</b> {quote.notes}</p>}
      {quote.valid_until && <p>Validade: {new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
      {quote.discount_cents > 0 && <p>Subtotal {money(quote.subtotal_cents)} · Desconto {money(quote.discount_cents)}</p>}
      <div className="approval-total"><span>Total a aprovar</span><strong>{money(quote.total_cents)}</strong></div>
      {quote.status === 'draft' && <div className="approval-actions"><button className="button primary" disabled={busy} onClick={() => void markReady()}>{busy ? 'Finalizando…' : 'Finalizar proposta'}</button><button className="button secondary" onClick={onCreateQuote}>Revisar proposta</button></div>}
      {quote.status === 'sent' && <><div className="approval-guidance"><b>Envie o link ao cliente</b><p>O sistema gera a página de aprovação; o envio pelo seu canal de contato é feito por você. A execução só será liberada após a aprovação registrada.</p></div>
        <div className="approval-actions"><button className="button secondary" disabled={busy} onClick={() => void createLink()}>Gerar link de aprovação</button><button className="button secondary" onClick={() => void refresh()}><RefreshCw size={14} /> Verificar resposta</button></div>
        {link && <div className="approval-link"><input aria-label="Link de aprovação" value={link} readOnly onFocus={event => event.currentTarget.select()} /><button className="button secondary" onClick={() => void copyLink()}><ClipboardCopy size={14} /> Copiar link</button></div>}
        {!awaiting && link && <div className="approval-send"><label>Canal usado para enviar<select value={channel} onChange={event => setChannel(event.target.value)}><option>WhatsApp</option><option>E-mail</option><option>Telefone</option><option>Outro</option></select></label><button className="button primary" onClick={() => onAdvance(`Link do orçamento v${quote.version} enviado ao cliente via ${channel}.`)}>Confirmar envio e aguardar aprovação</button></div>}</>}
      {quote.status === 'approved' && <div className="approval-guidance success"><CheckCircle2 size={17} /><div><b>Cliente aprovou {money(quote.total_cents)}</b><p>Os serviços descritos na proposta estão autorizados.</p></div></div>}
      {quote.status === 'approved' && awaiting && <button className="button primary" onClick={() => onAdvance()}>Iniciar execução autorizada</button>}
      {quote.status === 'approved' && !awaiting && <button className="button primary" onClick={() => onAdvance()}>Registrar aprovação na OS</button>}
      {['rejected', 'expired'].includes(quote.status) && <button className="button primary" onClick={onCreateQuote}>Preparar nova proposta</button>}
    </div>}
  </section>;
}
