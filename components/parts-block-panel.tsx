'use client';

import { useState } from 'react';
import type { Order } from '@/lib/demo';

type Props = {
  order: Order;
  liveMode: boolean;
  onUpdated?: () => void;
  notify: (message: string, error?: boolean) => void;
  onDemoChange: (change: Partial<Order>, description: string) => void;
};

export function PartsBlockPanel({ order, liveMode, onUpdated, notify, onDemoChange }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const blocked = Boolean(order.partsBlock);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (description.trim().length < 2) return notify('Informe qual peça está sendo aguardada.', true);
    setSaving(true);
    const partsBlock = { description: description.trim(), supplier: supplier.trim(), expectedDate, note: note.trim(), blockedAt: new Date().toISOString(), receivedAt: null };
    try {
      if (liveMode) {
        const response = await fetch(`/api/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'parts_block', partsDescription: partsBlock.description, partsSupplier: partsBlock.supplier, partsExpectedDate: partsBlock.expectedDate || null, partsNote: partsBlock.note || null }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) return notify(result.error ?? 'Não foi possível registrar a peça.', true);
        notify('OS pausada enquanto aguarda a peça.');
        onUpdated?.();
      } else {
        onDemoChange({ partsBlock }, 'Execução pausada: aguardando peça.');
      }
      setOpen(false);
    } finally { setSaving(false); }
  }

  async function resume() {
    setSaving(true);
    try {
      if (liveMode) {
        const response = await fetch(`/api/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'parts_resume' }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) return notify(result.error ?? 'Não foi possível registrar a chegada da peça.', true);
        notify('Peça recebida. A execução foi retomada.');
        onUpdated?.();
      } else onDemoChange({ partsBlock: null }, 'Peça recebida. Execução retomada.');
    } finally { setSaving(false); }
  }

  return <section className="drawer-section parts-block-panel" aria-label="Peças e impedimentos"><div className="section-label">Peças e impedimentos</div>{blocked ? <div className="parts-block-active"><div><b>Pausada — aguardando peça</b><span>{order.partsBlock?.description}{order.partsBlock?.supplier ? ` · ${order.partsBlock.supplier}` : ''}</span>{order.partsBlock?.expectedDate && <small>Previsão: {new Date(`${order.partsBlock.expectedDate}T12:00:00`).toLocaleDateString('pt-BR')}</small>}</div><button className="button primary compact" disabled={saving} onClick={() => void resume()}>{saving ? 'Salvando…' : 'Peça recebida'}</button></div> : !open ? <button className="button secondary compact" onClick={() => setOpen(true)}>Registrar peça aguardada</button> : <form className="parts-block-form" onSubmit={submit}><label>Peça necessária<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ex.: Fonte 500 W" required /></label><div className="form-grid"><label>Fornecedor<input value={supplier} onChange={event => setSupplier(event.target.value)} /></label><label>Previsão<input type="date" value={expectedDate} onChange={event => setExpectedDate(event.target.value)} /></label></div><label>Observação<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Pedido, prazo ou informação do fornecedor" /></label><div><button type="button" className="button secondary compact" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary compact" disabled={saving}>{saving ? 'Salvando…' : 'Pausar aguardando peça'}</button></div></form>}</section>;
}
