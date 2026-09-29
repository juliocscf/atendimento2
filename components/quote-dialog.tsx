'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@/lib/demo';

type QuoteDialogProps = {
  orders: Order[];
  liveMode: boolean;
  close: () => void;
  onCreated: () => void;
  notify: (message: string, error?: boolean) => void;
};

function parseCents(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function moneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function QuoteDialog({ orders, liveMode, close, onCreated, notify }: QuoteDialogProps) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('0,00');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const subtotal = useMemo(() => Math.max(0, Math.round(Number(quantity.replace(',', '.')) * parseCents(unitPrice))), [quantity, unitPrice]);
  const total = Math.max(0, subtotal - Math.min(subtotal, parseCents(discount)));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity.replace(',', '.'));
    const unitPriceCents = parseCents(unitPrice);
    if (!liveMode) return notify('Conecte o Supabase para criar um orçamento real.', true);
    if (!orderId || !description.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || unitPriceCents < 0) return notify('Informe OS, descrição, quantidade e valor válidos.', true);
    setSaving(true);
    try {
      const response = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceOrderId: orderId, validUntil: validUntil || null, discountCents: parseCents(discount), notes: notes.trim() || null, items: [{ description: description.trim(), quantity: parsedQuantity, unitPriceCents }] }) });
      const result = await response.json() as { data?: { version: number; total_cents: number }; error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível criar o orçamento.', true);
      notify(`Orçamento v${result.data?.version ?? ''} criado. Revise os itens antes de enviar.`);
      onCreated();
      close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title"><header><div><span className="eyebrow">Nexo · orçamento</span><h2 id="quote-dialog-title">Novo orçamento</h2><p>Monte uma proposta vinculada a uma ordem de serviço.</p></div><button className="icon-button" aria-label="Fechar janela" onClick={close}>×</button></header><div className="modal-body"><form onSubmit={submit}><div className="form-grid"><label>Ordem de serviço<select value={orderId} onChange={event => setOrderId(event.target.value)} required><option value="">Selecione</option>{orders.map(order => <option value={order.id} key={order.id}>{order.number} · {order.issue.slice(0, 42)}</option>)}</select></label><label>Validade<input type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label></div><div className="form-grid"><label>Item ou serviço<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ex.: Troca do SSD e reinstalação" required /></label><label>Quantidade<input type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><label>Valor unitário<input inputMode="decimal" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} placeholder="0,00" required /></label><label>Desconto<input inputMode="decimal" value={discount} onChange={event => setDiscount(event.target.value)} /></label></div><label className="full-label">Observações<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Prazo, garantia ou condições comerciais" /></label><div className="quote-total-preview"><span>Subtotal <b>{moneyInput(subtotal)}</b></span><span>Desconto <b>{moneyInput(parseCents(discount))}</b></span><strong>Total <b>{moneyInput(total)}</b></strong></div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar orçamento'}</button></div></form></div></section></div>;
}
