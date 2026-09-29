'use client';

import { useState } from 'react';
import type { Mode, Order } from '@/lib/demo';

type AppointmentDialogProps = {
  orders: Order[];
  liveMode: boolean;
  close: () => void;
  onCreated: () => void;
  notify: (message: string, error?: boolean) => void;
};

function cents(value: string) {
  const amount = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function AppointmentDialog({ orders, liveMode, close, onCreated, notify }: AppointmentDialogProps) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>('Remoto');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-09-29');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [address, setAddress] = useState('');
  const [remoteTool, setRemoteTool] = useState('');
  const [travelFee, setTravelFee] = useState('0,00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveMode) return notify('Conecte o Supabase para criar um compromisso real.', true);
    if (!orderId || title.trim().length < 2 || Number(duration) <= 0) return notify('Informe OS, título e duração válidos.', true);
    setSaving(true);
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceOrderId: orderId, mode, title: title.trim(), startAt: `${date}T${time}:00`, durationMinutes: Number(duration), address: address.trim() || null, remoteTool: remoteTool.trim() || null, travelFeeCents: cents(travelFee), notes: notes.trim() || null }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível criar o compromisso.', true);
      notify('Compromisso agendado com sucesso.');
      onCreated();
      close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title"><header><div><span className="eyebrow">Nexo · agenda</span><h2 id="appointment-dialog-title">Novo compromisso</h2><p>Agende uma sessão remota ou visita domiciliar vinculada à OS.</p></div><button className="icon-button" aria-label="Fechar janela" onClick={close}>×</button></header><div className="modal-body"><form onSubmit={submit}><div className="form-grid"><label>Ordem de serviço<select value={orderId} onChange={event => setOrderId(event.target.value)} required><option value="">Selecione</option>{orders.map(order => <option value={order.id} key={order.id}>{order.number} · {order.issue.slice(0, 42)}</option>)}</select></label><label>Modalidade<select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="Remoto">Remoto</option><option value="Domicílio">Domicílio</option><option value="Balcão">Balcão</option></select></label><label>Título<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Diagnóstico remoto" required /></label><label>Duração (minutos)<input type="number" min="15" step="15" value={duration} onChange={event => setDuration(event.target.value)} required /></label><label>Data<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label>Horário<input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label></div>{mode === 'Domicílio' && <div className="form-grid"><label>Endereço<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número · bairro" required /></label><label>Taxa de deslocamento<input inputMode="decimal" value={travelFee} onChange={event => setTravelFee(event.target.value)} placeholder="0,00" /></label></div>}{mode === 'Remoto' && <label className="full-label">Ferramenta externa<input value={remoteTool} onChange={event => setRemoteTool(event.target.value)} placeholder="Ex.: RustDesk, AnyDesk ou Meet" /></label>}<label className="full-label">Observações<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Instruções de acesso, referência ou preparação" /></label><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Agendando…' : 'Agendar compromisso'}</button></div></form></div></section></div>;
}
