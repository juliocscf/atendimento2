'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCopy, FileText, RefreshCw, ShieldCheck, UserCheck, X } from 'lucide-react';
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
  approved_at: string | null;
  approval_channel: 'portal' | 'manual' | null;
  approval_method: 'presencial' | 'telefone' | 'whatsapp' | 'email' | 'outro' | null;
  approved_customer_name: string | null;
  approval_note: string | null;
  approval_evidence_url: string | null;
  items: Array<FinancialItem & { id: string; description: string; service_code?: string | null; unit_price_cents: number }>;
};

const approvalMethodLabels = {
  presencial: 'Presencialmente',
  telefone: 'Por telefone',
  whatsapp: 'Por WhatsApp',
  email: 'Por e-mail',
  outro: 'Outro meio',
} as const;

export function OrderApprovalPanel({ order, liveMode, onCreateQuote, onAdvance, onSent, notify }: {
  order: Order;
  liveMode: boolean;
  onCreateQuote: () => void;
  onAdvance: (note?: string) => void;
  onSent?: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(liveMode);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMethod, setManualMethod] = useState<keyof typeof approvalMethodLabels>('presencial');
  const [manualName, setManualName] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualEvidence, setManualEvidence] = useState('');
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [manualError, setManualError] = useState('');
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
      notify('Orçamento finalizado. A OS agora aguarda a aprovação do cliente.');
      if (onSent) onSent(); else window.location.reload();
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

  async function registerManualApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || busy || !manualConfirmed) return;
    setBusy(true); setManualError('');
    try {
      const response = await fetch(`/api/quotes/${quote.id}/manual-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: manualMethod, customerName: manualName, note: manualNote, evidenceUrl: manualEvidence }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setManualError(result.error ?? 'Não foi possível registrar a autorização.'); return; }
      setManualOpen(false);
      notify('Autorização registrada. A OS continua aguardando até você iniciar a execução.');
      await refresh();
    } catch { setManualError('Não foi possível conectar ao servidor.'); }
    finally { setBusy(false); }
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
      {quote.items.map(item => <div className="approval-item" key={item.id}><span>{item.service_code && <b>{item.service_code} · </b>}{item.description}<small>{itemTypeLabels[item.item_type ?? 'unclassified']} · {item.quantity} × {money(item.unit_price_cents)}</small></span><b>{money(item.total_cents)}</b></div>)}
      <FinancialSummary breakdown={financialBreakdown(quote.items, quote.discount_cents)} />
      {quote.notes && <p><b>Condições:</b> {quote.notes}</p>}
      {quote.valid_until && <p>Validade: {new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
      {quote.discount_cents > 0 && <p>Subtotal {money(quote.subtotal_cents)} · Desconto {money(quote.discount_cents)}</p>}
      <div className="approval-total"><span>Total a aprovar</span><strong>{money(quote.total_cents)}</strong></div>
      {quote.status === 'draft' && <div className="approval-actions"><button className="button primary" disabled={busy} onClick={() => void markReady()}>{busy ? 'Finalizando…' : 'Finalizar proposta'}</button><button className="button secondary" onClick={onCreateQuote}>Revisar proposta</button></div>}
      {quote.status === 'sent' && <><div className="approval-guidance"><b>Envie o link ao cliente</b><p>O sistema gera a página de aprovação; o envio pelo seu canal de contato é feito por você. A execução só será liberada após a aprovação registrada.</p></div>
        <div className="approval-actions"><button className="button secondary" disabled={busy} onClick={() => void createLink()}>Gerar link de aprovação</button><button className="button secondary" onClick={() => void refresh()}><RefreshCw size={14} /> Verificar resposta</button><button className="button secondary" disabled={busy} onClick={() => setManualOpen(true)}><UserCheck size={14} /> Registrar autorização do cliente</button></div>
        {link && <div className="approval-link"><input aria-label="Link de aprovação" value={link} readOnly onFocus={event => event.currentTarget.select()} /><button className="button secondary" onClick={() => void copyLink()}><ClipboardCopy size={14} /> Copiar link</button></div>}
        {!awaiting && link && <div className="approval-send"><label>Canal usado para enviar<select value={channel} onChange={event => setChannel(event.target.value)}><option>WhatsApp</option><option>E-mail</option><option>Telefone</option><option>Outro</option></select></label><button className="button primary" onClick={() => onAdvance(`Link do orçamento v${quote.version} enviado ao cliente via ${channel}.`)}>Confirmar envio e aguardar aprovação</button></div>}</>}
      {quote.status === 'approved' && <div className="approval-guidance success"><CheckCircle2 size={17} /><div><b>{quote.approval_channel === 'manual' ? 'Autorização registrada pela equipe' : 'Aprovado pelo portal'} · {money(quote.total_cents)}</b><p>{quote.approval_channel === 'manual' ? <>{quote.approved_customer_name} autorizou {quote.approval_method ? approvalMethodLabels[quote.approval_method].toLowerCase() : 'com confirmação da equipe'}{quote.approved_at ? ` em ${new Date(quote.approved_at).toLocaleString('pt-BR')}` : ''}.</> : 'Os serviços descritos na proposta foram autorizados pelo cliente.'}</p>{quote.approval_note && <p><b>Registro:</b> {quote.approval_note}</p>}{quote.approval_evidence_url && <p><a href={quote.approval_evidence_url} target="_blank" rel="noreferrer">Abrir evidência informada</a></p>}</div></div>}
      {quote.status === 'approved' && awaiting && <button className="button primary" onClick={() => onAdvance()}>Iniciar execução autorizada</button>}
      {quote.status === 'approved' && !awaiting && <button className="button primary" onClick={() => onAdvance()}>Registrar aprovação na OS</button>}
      {['rejected', 'expired'].includes(quote.status) && <button className="button primary" onClick={onCreateQuote}>Preparar nova proposta</button>}
    </div>}
    {manualOpen && quote && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && setManualOpen(false)}><section className="modal manual-approval-modal" role="dialog" aria-modal="true" aria-labelledby="manual-approval-title"><header><div><span className="eyebrow">Autorização assistida</span><h2 id="manual-approval-title">Registrar decisão do cliente</h2><p>Use quando o cliente autorizou fora do portal. O registro ficará na auditoria e no histórico da OS.</p></div><button type="button" className="icon-button" aria-label="Fechar janela" disabled={busy} onClick={() => setManualOpen(false)}><X size={20} /></button></header><div className="modal-body"><form onSubmit={registerManualApproval}>
      <div className="manual-approval-warning"><ShieldCheck size={18} /><div><b>Confirme a autorização antes de registrar</b><p>O orçamento será bloqueado como aprovado. A execução ainda dependerá do botão “Iniciar execução autorizada”.</p></div></div>
      <div className="form-grid"><label>Como o cliente autorizou<select value={manualMethod} onChange={event => setManualMethod(event.target.value as keyof typeof approvalMethodLabels)}><option value="presencial">Presencialmente</option><option value="telefone">Por telefone</option><option value="whatsapp">Por WhatsApp</option><option value="email">Por e-mail</option><option value="outro">Outro meio</option></select></label><label>Nome de quem autorizou<input value={manualName} minLength={3} maxLength={120} onChange={event => setManualName(event.target.value)} placeholder="Nome do cliente ou responsável" required /></label></div>
      <label className="full-label">Observação {['telefone', 'outro'].includes(manualMethod) ? '(obrigatória)' : '(opcional)'}<textarea rows={3} minLength={['telefone', 'outro'].includes(manualMethod) ? 8 : 3} maxLength={1000} value={manualNote} onChange={event => setManualNote(event.target.value)} placeholder="Ex.: cliente confirmou pessoalmente após revisar os itens e o valor." required={['telefone', 'outro'].includes(manualMethod)} /></label>
      <label className="full-label">Link da evidência (opcional)<input type="url" value={manualEvidence} onChange={event => setManualEvidence(event.target.value)} placeholder="https://…" /><small>Você pode informar o link de uma foto, assinatura ou mensagem já armazenada.</small></label>
      <label className="manual-approval-confirm"><input type="checkbox" checked={manualConfirmed} onChange={event => setManualConfirmed(event.target.checked)} /><span>Confirmo que o cliente autorizou o orçamento v{quote.version}, no valor de {money(quote.total_cents)}.</span></label>
      {manualError && <div className="auth-feedback error" role="alert">{manualError}</div>}
      <div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={() => setManualOpen(false)}>Cancelar</button><button className="button primary" disabled={busy || !manualConfirmed || manualName.trim().length < 3}>{busy ? 'Registrando…' : 'Registrar autorização'}</button></div>
    </form></div></section></div>}
  </section>;
}
