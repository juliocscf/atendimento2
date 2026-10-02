'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { money, type Order } from '@/lib/demo';

type Props = {
  orders: Order[];
  initialOrderId?: string;
  liveMode: boolean;
  close: () => void;
  onCreated: () => void;
  notify: (message: string, error?: boolean) => void;
};
type Item = { description: string; quantity: string; unitPrice: string };
const emptyItem = (): Item => ({ description: '', quantity: '1', unitPrice: '' });
const moneyToCents = (value: string) => {
  const amount = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
};

export function QuoteDialog({ orders, initialOrderId, liveMode, close, onCreated, notify }: Props) {
  const [orderId, setOrderId] = useState(initialOrderId || orders[0]?.id || '');
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [discount, setDiscount] = useState('0,00');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [basedOnVersion, setBasedOnVersion] = useState<number | null>(null);
  const order = orders.find(candidate => candidate.id === orderId);
  const subtotal = items.reduce((sum, item) => sum + (Math.round(Number(item.quantity.replace(',', '.')) * moneyToCents(item.unitPrice)) || 0), 0);
  const discountCents = Math.min(subtotal, Math.max(0, moneyToCents(discount) || 0));

  useEffect(() => {
    if (!liveMode || !orderId) return;
    let active = true;
    void (async () => {
      try {
        const listResponse = await fetch(`/api/quotes?serviceOrderId=${encodeURIComponent(orderId)}`);
        const list = await listResponse.json() as { data?: Array<{ id: string; version: number }> };
        if (!listResponse.ok || !list.data?.length) { if (active) setBasedOnVersion(null); return; }
        const response = await fetch(`/api/quotes/${list.data[0].id}`);
        const result = await response.json() as { data?: { version: number; discount_cents: number; valid_until: string | null; notes: string | null; items: Array<{ description: string; quantity: number; unit_price_cents: number }> } };
        if (!active || !response.ok || !result.data) return;
        const quote = result.data;
        setBasedOnVersion(quote.version);
        setItems(quote.items.map(item => ({ description: item.description, quantity: String(item.quantity), unitPrice: (item.unit_price_cents / 100).toFixed(2).replace('.', ',') })));
        setDiscount((quote.discount_cents / 100).toFixed(2).replace('.', ','));
        setValidUntil(quote.valid_until ?? '');
        setNotes(quote.notes ?? '');
      } catch { /* keep the blank form available */ }
    })();
    return () => { active = false; };
  }, [liveMode, orderId]);

  function updateItem(index: number, change: Partial<Item>) {
    setItems(current => current.map((item, position) => position === index ? { ...item, ...change } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveMode) return notify('Conecte o Supabase para criar um orçamento real.', true);
    if (!orderId || items.some(item => !item.description.trim() || !item.unitPrice.trim() || !Number.isFinite(Number(item.quantity.replace(',', '.'))) || Number(item.quantity.replace(',', '.')) <= 0 || !Number.isFinite(moneyToCents(item.unitPrice)) || moneyToCents(item.unitPrice) < 0)) {
      return notify('Descreva cada serviço ou peça, quantidade e valor.', true);
    }
    setSaving(true);
    try {
      const response = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceOrderId: orderId, validUntil: validUntil || null, discountCents,
          notes: notes.trim() || null, items: items.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity.replace(',', '.')), unitPriceCents: moneyToCents(item.unitPrice) })) }) });
      const result = await response.json() as { data?: { version: number }; error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível criar o orçamento.', true);
      notify(`Orçamento v${result.data?.version ?? ''} salvo como rascunho. Confira e gere o link de aprovação na OS.`);
      onCreated(); close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title"><header><div>
      <span className="eyebrow">Nexo · proposta ao cliente</span><h2 id="quote-dialog-title">{basedOnVersion ? `Revisar orçamento v${basedOnVersion}` : 'Preparar orçamento'}</h2>
      <p>Descreva cada serviço e peça. O cliente verá esta proposta antes de aprovar.</p>
    </div><button type="button" className="icon-button" aria-label="Fechar janela" onClick={close}><X size={20} /></button></header>
      <div className="modal-body"><form onSubmit={submit}>
        <div className="form-grid"><label>Ordem de serviço<select value={orderId} onChange={event => setOrderId(event.target.value)} required><option value="">Selecione</option>
          {orders.map(candidate => <option value={candidate.id} key={candidate.id}>{candidate.number} · {candidate.issue.slice(0, 42)}</option>)}</select></label>
          <label>Validade da proposta<input type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })} /></label></div>
        {order && <div className="quote-context"><b>Problema informado pelo cliente</b><span>{order.issue}</span></div>}
        <div className="quote-items-heading"><b>Serviços e peças a aprovar</b><button type="button" className="button secondary compact" onClick={() => setItems(current => [...current, emptyItem()])}><Plus size={14} /> Adicionar item</button></div>
        {items.map((item, index) => <div className="quote-edit-item" key={index} role="group" aria-label={`Item ${index + 1}`}>
          <label className="full-label">Descrição do serviço ou peça<input value={item.description} onChange={event => updateItem(index, { description: event.target.value })} placeholder="Ex.: Troca da fonte e teste de estabilidade" required /></label>
          <div className="form-grid"><label>Quantidade<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} required /></label>
            <label>Valor unitário (R$)<input inputMode="decimal" value={item.unitPrice} onChange={event => updateItem(index, { unitPrice: event.target.value })} placeholder="0,00" required /></label></div>
          {items.length > 1 && <button type="button" className="quote-remove" aria-label={`Remover item ${index + 1}`} onClick={() => setItems(current => current.filter((_, position) => position !== index))}><Trash2 size={14} /> Remover</button>}
        </div>)}
        <div className="form-grid"><label>Desconto (R$)<input inputMode="decimal" value={discount} onChange={event => setDiscount(event.target.value)} /></label></div>
        <label className="full-label">Condições mostradas ao cliente<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: serviço em até 3 dias úteis; garantia de 90 dias para a peça substituída." /></label>
        <div className="quote-total-preview"><span>Subtotal <b>{money(subtotal)}</b></span><span>Desconto <b>{money(discountCents)}</b></span><strong>Total a aprovar <b>{money(subtotal - discountCents)}</b></strong></div>
        <p className="quote-disclosure">{basedOnVersion ? 'Ao salvar, uma nova versão será criada. Confira e envie o novo link para aprovação.' : 'O cliente verá a solicitação, o equipamento, cada item e valor, o desconto, o total, a validade e as condições.'}</p>
        <div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : basedOnVersion ? 'Salvar nova versão' : 'Salvar rascunho'}</button></div>
      </form></div>
    </section>
  </div>;
}
