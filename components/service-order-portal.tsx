'use client';

import { useMemo, useState } from 'react';
import { Check, CircleDollarSign, Clock3, FileText, Laptop, RefreshCcw, ShieldCheck, Wrench } from 'lucide-react';
import { money, statuses } from '@/lib/demo';
import { publicStatusLabels, type ServiceOrderPortalData } from '@/lib/service-order-portal';
import { PickupAuthorizationPortal } from '@/components/pickup-authorization-portal';

function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function dateOnly(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

export function ServiceOrderPortal({ token, initialData }: { token: string; initialData: ServiceOrderPortalData }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentIndex = statuses.indexOf(data.status);
  const events = useMemo(() => data.events.filter(event => statuses.includes(event.status)), [data.events]);

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/portal/orders/${token}/approve`, { method: 'POST' });
      const result = await response.json() as { data?: { status: 'approved'; approved_at: string; total_cents: number }; error?: string };
      if (!response.ok || !result.data) {
        setError(result.error ?? 'Não foi possível registrar a aprovação.');
        return;
      }
      setData(current => current.quote ? {
        ...current,
        total_cents: result.data!.total_cents,
        balance_cents: Math.max(0, result.data!.total_cents - current.paid_cents),
        quote: { ...current.quote, status: 'approved', approved_at: result.data!.approved_at },
      } : current);
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="tracking-page">
    <section className="tracking-card">
      <header className="tracking-header">
        <div><span className="tracking-brand">{data.organization_name}</span><small>{data.unit_name} · acompanhamento do atendimento</small></div>
        <div className="tracking-order"><span>Ordem de serviço</span><strong>{data.order_number}</strong></div>
      </header>

      <section className="tracking-intro">
        <span>Olá, {data.client_first_name}</span>
        <h1>{publicStatusLabels[data.status]}</h1>
        <p>Última atualização em {dateTime(data.updated_at)}</p>
      </section>

      <div className="tracking-progress" aria-label={`Etapa atual: ${publicStatusLabels[data.status]}`}>
        {statuses.map((status, index) => <div className={index <= currentIndex ? 'done' : ''} key={status}>
          <span>{index < currentIndex ? <Check size={14} /> : index + 1}</span>
          <small>{publicStatusLabels[status]}</small>
        </div>)}
      </div>

      <div className="tracking-grid">
        <section className="tracking-panel"><div className="tracking-label"><Laptop size={16} /> Equipamento</div><strong>{data.device_label}</strong><small>Recebido em {dateTime(data.created_at)}</small></section>
        <section className="tracking-panel"><div className="tracking-label"><Clock3 size={16} /> Previsão</div><strong>{data.due_date ? dateOnly(data.due_date) : 'A confirmar'}</strong><small>A data pode ser atualizada durante o diagnóstico.</small></section>
      </div>

      <section className="tracking-panel tracking-issue"><div className="tracking-label"><Wrench size={16} /> Problema informado</div><p>{data.issue}</p></section>

      {data.quote && <section className="tracking-quote">
        <div className="tracking-section-title"><FileText size={18} /><div><h2>Orçamento v{data.quote.version}</h2><p>{data.quote.status === 'sent' ? 'Confira os itens antes de autorizar.' : 'Orçamento aprovado pelo cliente.'}</p></div></div>
        <div className="tracking-items">{data.quote.items.map((item, index) => <div key={`${item.description}-${index}`}><span><b>{item.description}</b><small>{item.quantity} × {money(item.unit_price_cents)}</small></span><strong>{money(item.total_cents)}</strong></div>)}</div>
        {data.quote.notes && <div className="tracking-conditions"><b>Condições</b><p>{data.quote.notes}</p></div>}
        {data.quote.discount_cents > 0 && <div className="tracking-subtotal"><span>Subtotal</span><b>{money(data.quote.subtotal_cents)}</b><span>Desconto</span><b>−{money(data.quote.discount_cents)}</b></div>}
        <div className="tracking-total"><span>Total</span><strong>{money(data.quote.total_cents)}</strong></div>
        {data.quote.valid_until && <small className="tracking-validity">Proposta válida até {dateOnly(data.quote.valid_until)}</small>}
        {data.quote.status === 'sent' ? <button className="tracking-primary" disabled={busy} onClick={() => void approve()}>{busy ? 'Registrando aprovação…' : `Aprovar orçamento de ${money(data.quote.total_cents)}`}</button> : <div className="tracking-success"><Check size={18} /> Aprovado em {data.quote.approved_at ? dateTime(data.quote.approved_at) : 'data não informada'}</div>}
        {error && <div className="tracking-error" role="alert">{error}</div>}
      </section>}

      {data.total_cents > 0 && <section className="tracking-finance">
        <div className="tracking-section-title"><CircleDollarSign size={18} /><div><h2>Resumo financeiro</h2><p>Valores registrados nesta ordem de serviço.</p></div></div>
        <div><span>Total aprovado<strong>{money(data.total_cents)}</strong></span><span>Recebido<strong>{money(data.paid_cents)}</strong></span><span>Saldo pendente<strong>{money(data.balance_cents)}</strong></span></div>
      </section>}

      <PickupAuthorizationPortal token={token} available={data.third_party_pickup_available} initialAuthorization={data.pickup_authorization} />

      <section className="tracking-timeline">
        <div className="tracking-section-title"><Clock3 size={18} /><div><h2>Histórico do atendimento</h2><p>Somente as mudanças de etapa são exibidas.</p></div></div>
        <div>{events.map((event, index) => <article key={`${event.status}-${event.created_at}-${index}`}><span className="tracking-dot"><Check size={12} /></span><div><b>{publicStatusLabels[event.status]}</b><small>{dateTime(event.created_at)}</small></div></article>)}</div>
      </section>

      <footer className="tracking-footer"><ShieldCheck size={17} /><span>Este link mostra somente informações deste atendimento.</span><button onClick={() => window.location.reload()}><RefreshCcw size={14} /> Atualizar</button></footer>
    </section>
    <style>{`
      .tracking-page{min-height:100vh;background:#f3f6fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:28px 14px}.tracking-card{max-width:760px;margin:0 auto;background:#fff;border:1px solid #dbe2ee;border-radius:22px;padding:32px;box-shadow:0 20px 60px #1d355712}.tracking-header{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e8edf5;padding-bottom:22px}.tracking-brand{display:block;color:#2458d6;font-size:22px;font-weight:800}.tracking-header small,.tracking-order span{color:#64748b;font-size:12px}.tracking-order{text-align:right}.tracking-order span,.tracking-order strong{display:block}.tracking-order strong{font-size:20px;margin-top:5px}.tracking-intro{padding:28px 0 20px}.tracking-intro span,.tracking-intro p{color:#64748b;font-size:13px}.tracking-intro h1{font-size:32px;margin:7px 0}.tracking-progress{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;border:1px solid #e4eaf3;border-radius:16px;padding:16px 10px;margin-bottom:22px}.tracking-progress div{display:grid;justify-items:center;gap:7px;text-align:center;color:#94a3b8}.tracking-progress div>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#edf1f6;font-weight:800;font-size:12px}.tracking-progress small{font-size:10px}.tracking-progress .done{color:#2458d6}.tracking-progress .done>span{background:#e6edff}.tracking-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.tracking-panel,.tracking-quote,.tracking-finance,.tracking-timeline{border:1px solid #e4eaf3;border-radius:15px;padding:18px;margin-top:14px}.tracking-panel{display:grid;gap:7px}.tracking-panel small{color:#64748b}.tracking-label{display:flex;align-items:center;gap:7px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.tracking-issue p{margin:0;line-height:1.6}.tracking-section-title{display:flex;align-items:flex-start;gap:10px}.tracking-section-title h2{font-size:16px;margin:0}.tracking-section-title p{color:#64748b;font-size:12px;margin:3px 0 0}.tracking-items{margin-top:12px}.tracking-items>div{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #edf1f6;padding:12px 0}.tracking-items span{display:grid;gap:3px}.tracking-items small{color:#64748b}.tracking-conditions{background:#f7f9fc;border-radius:10px;padding:13px;margin-top:14px}.tracking-conditions p{margin:4px 0 0;white-space:pre-wrap}.tracking-subtotal{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:14px;color:#64748b;font-size:12px}.tracking-total{display:flex;justify-content:space-between;align-items:center;padding:18px 0 5px}.tracking-total strong{font-size:27px;color:#2458d6}.tracking-validity{color:#64748b}.tracking-primary{width:100%;border:0;border-radius:11px;background:#2458d6;color:#fff;padding:14px;font-weight:800;margin-top:18px;cursor:pointer}.tracking-primary:disabled{opacity:.6;cursor:wait}.tracking-success,.tracking-error{display:flex;align-items:center;gap:8px;border-radius:11px;padding:13px;margin-top:16px;font-weight:700}.tracking-success{background:#e9f8ef;color:#187247}.tracking-error{background:#fff0ef;color:#b42318}.tracking-finance>div:last-child{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px}.tracking-finance span{display:grid;gap:5px;color:#64748b;font-size:11px}.tracking-finance span strong{color:#172033;font-size:16px}.tracking-timeline>div:last-child{margin-top:14px}.tracking-timeline article{display:flex;gap:12px;position:relative;padding:0 0 18px}.tracking-timeline article:not(:last-child):before{content:'';position:absolute;left:11px;top:22px;bottom:0;width:1px;background:#dbe2ee}.tracking-dot{display:grid;place-items:center;flex:0 0 23px;height:23px;border-radius:50%;background:#e6edff;color:#2458d6}.tracking-timeline article div{display:grid;gap:3px}.tracking-timeline article small{color:#64748b}.tracking-footer{display:flex;align-items:center;gap:8px;color:#64748b;font-size:12px;border-top:1px solid #edf1f6;margin-top:22px;padding-top:18px}.tracking-footer button{margin-left:auto;display:flex;align-items:center;gap:6px;background:none;border:0;color:#2458d6;font-weight:700;cursor:pointer}@media(max-width:650px){.tracking-card{padding:22px 16px;border-radius:16px}.tracking-header{align-items:flex-start}.tracking-brand{font-size:18px}.tracking-order strong{font-size:16px}.tracking-intro h1{font-size:27px}.tracking-progress{display:flex;overflow-x:auto;justify-content:flex-start}.tracking-progress div{min-width:82px}.tracking-grid,.tracking-finance>div:last-child{grid-template-columns:1fr}.tracking-footer{align-items:flex-start;flex-wrap:wrap}.tracking-footer button{margin-left:0;width:100%;justify-content:center;padding:10px}}
    `}</style>
  </main>;
}
