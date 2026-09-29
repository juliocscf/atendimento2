'use client';

import { useState } from 'react';
import { money } from '@/lib/demo';

type PortalQuoteData = { quote_id: string; order_number: string; client_name: string; device_label: string; issue: string; quote_status: string; valid_until: string | null; total_cents: number; items: Array<{ description: string; quantity: number; unitPriceCents: number; totalCents: number }> };

export function PortalQuote({ token, quote }: { token: string; quote: PortalQuoteData }) {
  const [status, setStatus] = useState(quote.quote_status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function approve() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/portal/quotes/${token}/approve`, { method: 'POST' });
      const result = await response.json() as { data?: { status: string }; error?: string };
      if (!response.ok) { setError(result.error ?? 'Não foi possível registrar a aprovação.'); return; }
      setStatus(result.data?.status ?? 'approved');
    } catch { setError('Não foi possível conectar ao servidor.'); }
    finally { setBusy(false); }
  }
  return <main className="portal-page"><section className="portal-card"><header><div><span className="portal-brand">Nexo</span><small>Proposta de serviço</small></div><strong>{quote.order_number}</strong></header><div className="portal-intro"><span>Olá, {quote.client_name}</span><h1>Confira seu orçamento</h1><p>{quote.device_label}</p></div><div className="portal-issue"><b>Solicitação</b><span>{quote.issue}</span></div><div className="portal-items">{quote.items.map((item, index) => <div className="portal-item" key={`${item.description}-${index}`}><span><b>{item.description}</b><small>{item.quantity} × {money(item.unitPriceCents)}</small></span><strong>{money(item.totalCents)}</strong></div>)}</div><div className="portal-total"><span>Total proposto</span><strong>{money(quote.total_cents)}</strong></div>{quote.valid_until && <small className="portal-validity">Válido até {new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString('pt-BR')}</small>}{status === 'approved' ? <div className="portal-success">Orçamento aprovado. A equipe já pode seguir com o atendimento.</div> : status === 'rejected' ? <div className="portal-error">Este orçamento foi recusado.</div> : <button className="portal-approve" disabled={busy || status !== 'sent'} onClick={approve}>{busy ? 'Registrando…' : 'Aprovar orçamento'}</button>}{error && <div className="portal-error">{error}</div>}<p className="portal-note">Este link é temporário e serve apenas para consultar e aprovar esta proposta.</p></section><style>{`.portal-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:32px}.portal-card{max-width:620px;margin:0 auto;background:#fff;border:1px solid #dbe2ee;border-radius:20px;padding:34px;box-shadow:0 18px 50px #1d355714}.portal-card header{display:flex;justify-content:space-between;align-items:start;border-bottom:1px solid #edf0f5;padding-bottom:22px}.portal-brand{display:block;color:#2458d6;font-size:24px;font-weight:800}.portal-card header small{color:#64748b}.portal-card header strong{font-size:20px}.portal-intro{padding:28px 0 20px}.portal-intro span{color:#64748b;font-size:14px}.portal-intro h1{margin:7px 0;font-size:30px}.portal-intro p{margin:0;color:#2458d6;font-weight:700}.portal-issue{display:grid;gap:5px;border:1px solid #e6ebf3;border-radius:12px;padding:15px;color:#475569}.portal-issue b{color:#172033;font-size:12px;text-transform:uppercase;letter-spacing:.1em}.portal-items{margin-top:22px}.portal-item{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #edf0f5}.portal-item span{display:grid;gap:4px}.portal-item small{color:#64748b}.portal-total{display:flex;justify-content:space-between;align-items:center;padding:22px 0 4px}.portal-total strong{font-size:28px;color:#2458d6}.portal-validity,.portal-note{display:block;color:#64748b;font-size:12px}.portal-approve{width:100%;margin-top:24px;border:0;border-radius:12px;background:#2458d6;color:#fff;padding:15px;font-weight:800;cursor:pointer}.portal-approve:disabled{opacity:.5;cursor:not-allowed}.portal-success,.portal-error{margin-top:20px;border-radius:12px;padding:14px;font-weight:700}.portal-success{background:#e8f8ef;color:#197044}.portal-error{background:#fff0ef;color:#b42318}.portal-note{border-top:1px solid #edf0f5;margin-top:24px;padding-top:16px}@media(max-width:600px){.portal-page{padding:14px}.portal-card{padding:22px}.portal-intro h1{font-size:25px}}`}</style></main>;
}
