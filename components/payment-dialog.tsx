'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@/lib/demo';

type PaymentDialogProps = {
  orders: Order[];
  liveMode: boolean;
  close: () => void;
  onCreated: () => void;
  notify: (message: string, error?: boolean) => void;
};

function parseCents(value: string) {
  const amount = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatAmount(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function PaymentDialog({ orders, liveMode, close, onCreated, notify }: PaymentDialogProps) {
  const [orderId, setOrderId] = useState(orders.find(order => order.amount > order.paid)?.id ?? orders[0]?.id ?? '');
  const selected = orders.find(order => order.id === orderId);
  const [amount, setAmount] = useState(selected ? formatAmount(Math.max(0, selected.amount - selected.paid)) : '');
  const [method, setMethod] = useState('pix');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const balance = useMemo(() => selected ? Math.max(0, selected.amount - selected.paid) : 0, [selected]);

  function changeOrder(nextId: string) {
    setOrderId(nextId);
    const next = orders.find(order => order.id === nextId);
    setAmount(next ? formatAmount(Math.max(0, next.amount - next.paid)) : '');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseCents(amount);
    if (!liveMode) return notify('Conecte o Supabase para registrar um recebimento real.', true);
    if (!orderId || amountCents <= 0 || amountCents > balance) return notify('Informe um valor válido dentro do saldo pendente.', true);
    setSaving(true);
    try {
      const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceOrderId: orderId, amountCents, method, note: note.trim() || null, idempotencyKey: crypto.randomUUID() }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível registrar o recebimento.', true);
      notify('Recebimento registrado e saldo atualizado.');
      onCreated();
      close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title"><header><div><span className="eyebrow">Nexo · financeiro</span><h2 id="payment-dialog-title">Registrar recebimento</h2><p>O lançamento atualiza o saldo da ordem de serviço.</p></div><button className="icon-button" aria-label="Fechar janela" onClick={close}>×</button></header><div className="modal-body"><form onSubmit={submit}><label className="full-label">Ordem de serviço<select value={orderId} onChange={event => changeOrder(event.target.value)} required><option value="">Selecione</option>{orders.map(order => <option value={order.id} key={order.id}>{order.number} · saldo {formatAmount(Math.max(0, order.amount - order.paid))}</option>)}</select></label><div className="form-grid"><label>Valor recebido<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" required /></label><label>Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label></div><label className="full-label">Observação<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: entrada, parcela ou comprovante" /></label><div className="form-hint">Saldo disponível: <b>R$ {formatAmount(balance)}</b></div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar recebimento'}</button></div></form></div></section></div>;
}
