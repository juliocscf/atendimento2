'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileCheck2, FileText, LoaderCircle, ReceiptText, RefreshCw, Send, Settings2, ShieldCheck, X } from 'lucide-react';
import { money } from '@/lib/demo';
import { fiscalStatusLabels, type FiscalData, type FiscalDocument, type FiscalSale } from '@/lib/fiscal';

export function FiscalView({ liveMode, notify }: { liveMode: boolean; notify: (message: string, error?: boolean) => void }) {
  const [data, setData] = useState<FiscalData | null>(null);
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [cancelDocument, setCancelDocument] = useState<FiscalDocument | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const generation = useRef(0);

  const load = useCallback(async (selectedUnit = '') => {
    if (!liveMode) return;
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/fiscal${selectedUnit ? `?unitId=${selectedUnit}` : ''}`, { cache: 'no-store' });
      const result = await response.json() as { data?: FiscalData; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'Não foi possível carregar o módulo fiscal.');
      if (current === generation.current) { setData(result.data); setUnitId(result.data.unitId); }
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Falha na consulta fiscal.'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [liveMode]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(unitId); }, 0); return () => window.clearTimeout(timer); }, [load, unitId]);
  const pendingDocument = data?.sales.find(sale => ['submitting', 'queued', 'processing', 'cancel_pending'].includes(sale.document?.status ?? ''))?.document;
  useEffect(() => {
    if (!pendingDocument || busyId) return;
    const timer = window.setTimeout(async () => {
      try { await fetch(`/api/fiscal/${pendingDocument.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) }); }
      finally { void load(); }
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [pendingDocument, busyId, load]);

  const metrics = useMemo(() => {
    const sales = data?.sales ?? [];
    return {
      ready: sales.filter(sale => sale.ready && !sale.document).length,
      issued: sales.filter(sale => sale.document?.status === 'issued').length,
      pending: sales.filter(sale => ['submitting', 'queued', 'processing', 'cancel_pending'].includes(sale.document?.status ?? '')).length,
      errors: sales.filter(sale => sale.document?.status === 'error').length,
    };
  }, [data]);

  async function issue(sale: FiscalSale) {
    setBusyId(sale.id); setError('');
    try {
      const response = await fetch('/api/fiscal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'issue', saleId: sale.id, unitId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível emitir a NFC-e.');
      notify('NFC-e enviada ao Notaas. O status será atualizado automaticamente.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha na emissão.'); }
    finally { setBusyId(''); }
  }

  async function refresh(document: FiscalDocument) {
    setBusyId(document.id); setError('');
    try {
      const response = await fetch(`/api/fiscal/${document.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o status.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao atualizar.'); }
    finally { setBusyId(''); }
  }

  async function cancel() {
    if (!cancelDocument || cancelReason.trim().length < 15) return;
    setBusyId(cancelDocument.id); setError('');
    try {
      const response = await fetch(`/api/fiscal/${cancelDocument.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', reason: cancelReason.trim() }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível solicitar o cancelamento fiscal.');
      setCancelDocument(null); setCancelReason('');
      notify('Cancelamento fiscal enviado ao Notaas.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha no cancelamento fiscal.'); }
    finally { setBusyId(''); }
  }

  if (!liveMode) return <section className="panel fiscal-empty"><ReceiptText /><h3>Documentos fiscais</h3><p>Entre com sua conta para consultar e emitir documentos fiscais.</p></section>;
  if (!data && loading) return <section className="panel fiscal-empty"><LoaderCircle className="spin" /><p>Preparando o módulo fiscal…</p></section>;
  if (!data) return <section className="panel fiscal-empty"><AlertCircle /><p>{error}</p><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></section>;
  const canManage = ['gestor', 'atendimento'].includes(data.role);

  return <div className="fiscal-view view-stack">
    <section className="fiscal-hero">
      <div className="fiscal-hero-copy"><span className="fiscal-kicker"><ShieldCheck size={15}/> Integração fiscal protegida</span><h2>Da venda ao documento fiscal, sem retrabalho.</h2><p>Emita NFC-e das vendas diretas, acompanhe a autorização e mantenha DANFE e XML organizados.</p></div>
      <div className="fiscal-hero-actions"><label>Unidade<select value={unitId} onChange={event => setUnitId(event.target.value)}>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><button aria-label="Atualizar documentos fiscais" onClick={() => void load(unitId)} disabled={loading}><RefreshCw size={17}/></button></div>
    </section>
    {!data.configured && <section className="fiscal-setup"><span><Settings2 size={20}/></span><div><b>Integração pronta para receber a chave do Notaas</b><p>Cadastros e validações já estão ativos. Para emitir, adicione <code>NOTAAS_API_KEY</code> às variáveis protegidas do ambiente de produção.</p></div></section>}
    <div className="fiscal-metrics"><article><span className="blue"><Send/></span><small>Prontas para emitir</small><strong>{metrics.ready}</strong></article><article><span className="green"><FileCheck2/></span><small>Autorizadas</small><strong>{metrics.issued}</strong></article><article><span className="amber"><LoaderCircle/></span><small>Em processamento</small><strong>{metrics.pending}</strong></article><article><span className="red"><AlertCircle/></span><small>Precisam de atenção</small><strong>{metrics.errors}</strong></article></div>
    {error && <p className="fiscal-error" role="alert">{error}</p>}
    <section className="panel fiscal-list">
      <header><div><span className="eyebrow">Vendas diretas</span><h3>Fila fiscal</h3><p>A venda comercial e o documento fiscal têm ciclos separados para preservar histórico e segurança.</p></div><span>{data.sales.length} vendas</span></header>
      <div className="fiscal-rows">
        {data.sales.map(sale => <article key={sale.id}>
          <span className={`fiscal-sale-icon ${sale.document?.status ?? (sale.ready ? 'ready' : 'missing')}`}><FileText size={18}/></span>
          <div className="fiscal-sale-main"><b>Venda {sale.id.slice(0,8).toUpperCase()}</b><small>{sale.client_name} · {new Date(sale.created_at).toLocaleString('pt-BR')}</small><em>{sale.item_count} {sale.item_count === 1 ? 'item' : 'itens'}</em></div>
          <strong>{money(sale.total_cents)}</strong>
          <div className="fiscal-sale-state">
            {sale.document ? <><span className={`fiscal-status ${sale.document.status}`}>{fiscalStatusLabels[sale.document.status]}</span>{sale.document.number && <small>Nº {sale.document.number}{sale.document.series ? ` · série ${sale.document.series}` : ''}</small>}{sale.document.error_message && <small className="error">{sale.document.error_message}</small>}</> : sale.status !== 'confirmed' ? <span className="fiscal-status muted">Venda {sale.status === 'cancelled' ? 'cancelada' : 'devolvida'}</span> : sale.ready ? <span className="fiscal-status ready">Pronta</span> : <><span className="fiscal-status missing">Cadastro incompleto</span><small>Falta: {sale.missing.join(', ')}</small></>}
          </div>
          <div className="fiscal-row-actions">
            {!sale.document && sale.ready && sale.status === 'confirmed' && <button className="button primary compact" disabled={!canManage || !data.configured || busyId === sale.id} onClick={() => void issue(sale)}>{busyId === sale.id ? 'Enviando…' : 'Emitir NFC-e'}</button>}
            {sale.document && ['submitting','queued','processing','cancel_pending'].includes(sale.document.status) && <button className="button secondary compact" disabled={busyId === sale.document.id || !data.configured} onClick={() => void refresh(sale.document!)}><RefreshCw size={14}/> Atualizar</button>}
            {sale.document?.status === 'error' && sale.status === 'confirmed' && <button className="button primary compact" disabled={!canManage || !data.configured || busyId === sale.id} onClick={() => void issue(sale)}>{busyId === sale.id ? 'Reenviando…' : 'Corrigir e tentar novamente'}</button>}
            {sale.document && ['issued','cancelled'].includes(sale.document.status) && <><a className="button secondary compact" href={`/api/fiscal/${sale.document.id}/document?type=danfe`} target="_blank" rel="noreferrer"><Download size={14}/> DANFE</a><a className="button secondary compact" href={`/api/fiscal/${sale.document.id}/document?type=xml`} target="_blank" rel="noreferrer"><Download size={14}/> XML</a></>}
            {sale.document?.status === 'issued' && canManage && <button className="fiscal-cancel-link" onClick={() => { setCancelDocument(sale.document); setCancelReason(''); }}>Cancelar nota</button>}
          </div>
        </article>)}
        {!data.sales.length && <div className="fiscal-empty"><ReceiptText/><b>Nenhuma venda direta encontrada</b><span>As vendas confirmadas aparecerão aqui.</span></div>}
      </div>
    </section>
    <section className="fiscal-guidance"><CheckCircle2/><div><b>Antes da primeira emissão</b><p>Confirme no Notaas o CNPJ emitente, certificado digital, regime tributário, numeração e CSC da NFC-e. Os códigos NCM, CFOP e CSOSN/CST devem ser validados com a contabilidade.</p></div></section>
    {cancelDocument && <div className="fiscal-modal-backdrop"><section className="fiscal-modal" role="dialog" aria-modal="true"><header><div><span><AlertCircle size={19}/></span><div><small>Operação junto à SEFAZ</small><h3>Cancelar NFC-e</h3></div></div><button aria-label="Fechar" onClick={() => setCancelDocument(null)}><X size={19}/></button></header><p>Isso cancela o documento fiscal no Notaas. A venda continuará preservada no histórico comercial.</p><label>Motivo do cancelamento<textarea autoFocus minLength={15} maxLength={255} value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Informe um motivo claro com pelo menos 15 caracteres"/></label><div><button className="button secondary" onClick={() => setCancelDocument(null)}>Voltar</button><button className="button danger" disabled={busyId === cancelDocument.id || cancelReason.trim().length < 15} onClick={() => void cancel()}>{busyId === cancelDocument.id ? 'Enviando…' : 'Confirmar cancelamento fiscal'}</button></div></section></div>}
  </div>;
}
