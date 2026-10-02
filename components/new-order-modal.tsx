'use client';

import { useState, type FormEvent } from 'react';
import { CalendarDays, ChevronRight, Headphones, House, ShieldCheck, Store, X } from 'lucide-react';
import { type Mode, type DemoData, hasConflict, nowLabel } from '@/lib/demo';
import { useDemo } from '@/components/demo-provider';

type Props = {
  data: DemoData;
  initialClientId?: string;
  liveMode?: boolean;
  onCreated?: () => void;
  close: () => void;
  notify: (message: string, error?: boolean) => void;
};

const modeIcons = { Balcão: Store, Remoto: Headphones, Domicílio: House };
const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240];
const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function NewOrderModal({ data, initialClientId = '', liveMode = false, onCreated, close, notify }: Props) {
  const { commit } = useDemo();
  const [mode, setMode] = useState<Mode>('Balcão');
  const [clientId, setClientId] = useState(initialClientId || data.clients[0]?.id || '');
  const [deviceId, setDeviceId] = useState(data.devices.find(device => device.clientId === (initialClientId || data.clients[0]?.id))?.id ?? '');
  const [issue, setIssue] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [date, setDate] = useState(todayInBrazil);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const filteredDevices = data.devices.filter(device => device.clientId === clientId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId || issue.trim().length < 8) return notify('Informe o cliente e descreva o problema em pelo menos 8 caracteres.', true);
    const startAt = new Date(`${date}T${time}:00-03:00`);
    if (scheduled && (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now() || !durationOptions.includes(duration))) {
      return notify('Escolha uma data futura, horário e duração válidos.', true);
    }
    if (scheduled && mode === 'Domicílio' && !address.trim()) return notify('Informe o endereço da visita.', true);

    setSaving(true);
    try {
      if (liveMode) {
        const response = await fetch('/api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, deviceId, mode, priority: 'Normal', issue: issue.trim(),
            dueDate: scheduled ? date : todayInBrazil(),
            ...(scheduled ? { schedule: { startAt: startAt.toISOString(), durationMinutes: duration, address: address.trim() } } : {}) }),
        });
        const result = await response.json() as { data?: { number: string }; error?: string };
        if (!response.ok) return notify(result.error ?? 'Não foi possível abrir a OS.', true);
        notify(`${result.data?.number ?? 'OS'} criada${scheduled ? ' e agendada' : ''} com sucesso.`);
        onCreated?.();
        close();
        return;
      }

      const orderId = `o-${crypto.randomUUID()}`;
      const nextNumber = `OS-${new Date().getFullYear()}-${1250 + data.orders.length}`;
      const candidate = { id: `a-${crypto.randomUUID()}`, orderId, date, time, duration,
        technician: 'Rafael Costa', title: mode === 'Remoto' ? 'Atendimento remoto' : mode === 'Domicílio' ? 'Visita ao cliente' : 'Atendimento no balcão',
        mode, address: mode === 'Domicílio' ? address.trim() : 'Matriz · Centro' };
      if (scheduled && hasConflict(data.appointments, candidate)) return notify('Este horário já está ocupado na agenda de Rafael Costa.', true);
      const success = commit(current => ({ ...current,
        orders: [{ id: orderId, createdAt: new Date().toISOString(), number: nextNumber, clientId, deviceId,
          mode, status: 'Recebido', priority: 'Normal', technician: 'Rafael Costa', issue: issue.trim(),
          due: scheduled ? date : todayInBrazil(), amount: 0, paid: 0, accessories: '',
          history: [{ text: 'Atendimento aberto na unidade Matriz · Centro.', at: nowLabel() }], contacts: [] }, ...current.orders],
        appointments: scheduled ? [...current.appointments, candidate] : current.appointments,
      }), `${nextNumber} criada${scheduled ? ' e agendada' : ''} com sucesso.`);
      if (success) close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
      <header><div><span className="eyebrow">Nexo · atendimento</span><h2 id="new-order-title">Abrir novo atendimento</h2>
        <p>Comece com os dados essenciais e, se quiser, reserve um horário.</p></div>
        <button type="button" className="icon-button" aria-label="Fechar janela" onClick={close}><X size={20} /></button></header>
      <div className="modal-body"><form onSubmit={submit}>
        <div className="modal-step"><span className="step-number">1</span><div><b>Como será o atendimento?</b><small>Escolha a modalidade para orientar os próximos passos.</small></div></div>
        <div className="mode-picker">{(['Balcão', 'Remoto', 'Domicílio'] as Mode[]).map(option => {
          const Icon = modeIcons[option];
          return <button type="button" className={mode === option ? 'selected' : ''} onClick={() => setMode(option)} key={option}>
            <Icon size={19} /><b>{option}</b><small>{option === 'Balcão' ? 'Na unidade' : option === 'Remoto' ? 'Sessão online' : 'No endereço'}</small>
          </button>;
        })}</div>
        <div className="form-grid"><label>Cliente<select value={clientId} onChange={event => { setClientId(event.target.value); setDeviceId(data.devices.find(device => device.clientId === event.target.value)?.id ?? ''); }} required>
          <option value="">Selecione</option>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select></label><label>Equipamento<select value={deviceId} onChange={event => setDeviceId(event.target.value)}>
          <option value="">Sem equipamento vinculado</option>{filteredDevices.map(device => <option key={device.id} value={device.id}>{device.code} · {device.brand} {device.model}</option>)}
        </select></label></div>
        <label className="full-label">Defeito relatado<textarea value={issue} onChange={event => setIssue(event.target.value)} placeholder="Ex.: notebook não liga desde ontem e faz um ruído ao conectar o carregador." rows={4} required minLength={8} /></label>
        <label className="schedule-toggle"><input type="checkbox" checked={scheduled} onChange={event => setScheduled(event.target.checked)} /><CalendarDays size={17} /> Agendar atendimento agora</label>
        {scheduled && <div className="schedule-fields"><p>O horário ficará reservado na sua agenda. Você poderá alterá-lo depois.</p>
          <div className="form-grid"><label>Data<input type="date" min={todayInBrazil()} value={date} onChange={event => setDate(event.target.value)} required /></label>
            <label>Horário<input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label>
            <label>Duração<select value={duration} onChange={event => setDuration(Number(event.target.value))}>{durationOptions.map(minutes => <option value={minutes} key={minutes}>{minutes} minutos</option>)}</select></label>
            {mode === 'Domicílio' && <label>Endereço da visita<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número e bairro" required /></label>}
          </div></div>}
        <div className="form-hint"><ShieldCheck size={16} /> O histórico será vinculado ao cliente e ao equipamento automaticamente.</div>
        <div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button>
          <button className="button primary" disabled={saving}>{saving ? 'Salvando…' : <>{scheduled ? 'Criar e agendar' : 'Criar atendimento'} <ChevronRight size={16} /></>}</button></div>
      </form></div>
    </section>
  </div>;
}
