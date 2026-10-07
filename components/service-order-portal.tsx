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
  const partsBlock = data.parts_block;
  const partsEvents = data.parts_events ?? [];

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

      {partsBlock?.active && <section className="tracking-parts-alert" role="status">
        <div className="tracking-parts-icon"><Clock3 size={20} /></div>
        <div>
          <strong>Serviço pausado — aguardando peça</strong>
          <p>{partsBlock.description ? `Estamos aguardando: ${partsBlock.description}.` : 'A assistência está aguardando uma peça para continuar o serviço.'}</p>
          {partsBlock.expected_date && <small>Previsão de chegada: {dateOnly(partsBlock.expected_date)}</small>}
          {partsBlock.note && <small>{partsBlock.note}</small>}
        </div>
      </section>}

      {!partsBlock?.active && partsBlock?.received_at && <section className="tracking-parts-resumed" role="status">
        <Check size={18} />
        <div><strong>Peça recebida — serviço retomado</strong><small>Atualizado em {dateTime(partsBlock.received_at)}</small></div>
      </section>}

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
        {partsEvents.length > 0 && <div className="tracking-parts-events">{partsEvents.map((event, index) => <article key={`${event.created_at}-${index}`}><span className="tracking-dot tracking-dot-parts"><Clock3 size={12} /></span><div><b>{event.description}</b><small>{dateTime(event.created_at)}</small></div></article>)}</div>}
      </section>

      <footer className="tracking-footer"><ShieldCheck size={17} /><span>Este link mostra somente informações deste atendimento.</span><button onClick={() => window.location.reload()}><RefreshCcw size={14} /> Atualizar</button></footer>
    </section>
    <style>{`
      .tracking-parts-alert,.tracking-parts-resumed{display:flex;align-items:flex-start;gap:12px;border-radius:15px;padding:16px 18px;margin:0 0 22px}.tracking-parts-alert{border:1px solid #f2d19b;background:#fff8e8;color:#7a4b00}.tracking-parts-resumed{border:1px solid #bde8cf;background:#effbf3;color:#187247}.tracking-parts-icon{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:10px;background:#ffe7b5;color:#a66300}.tracking-parts-alert strong,.tracking-parts-resumed strong{display:block;font-size:15px}.tracking-parts-alert p{margin:4px 0 6px;color:#7a4b00;line-height:1.45}.tracking-parts-alert small,.tracking-parts-resumed small{display:block;color:#856b3d;font-size:12px;margin-top:3px}.tracking-parts-resumed svg{margin-top:2px}.tracking-parts-resumed small{color:#397752}.tracking-parts-events{margin-top:14px}.tracking-dot-parts{background:#fff1d0;color:#a66300}
    `}</style>
  </main>;
}
