'use client';

import { useEffect, useState } from 'react';
import { Check, Clock3, Home, Laptop, X } from 'lucide-react';
import type { Appointment, DemoData } from '@/lib/demo';

type Session = { id: string; tool_name: string; authorization_at: string | null; started_at: string | null; ended_at: string | null; summary: string | null };
type AppointmentEvent = { id: string; description: string; created_at: string };

export function AppointmentDrawer({ appointment, data, liveMode, close, notify, onUpdated }: { appointment: Appointment; data: DemoData; liveMode: boolean; close: () => void; notify: (message: string, error?: boolean) => void; onUpdated: () => void }) {
  const order = data.orders.find(item => item.id === appointment.orderId);
  const client = data.clients.find(item => item.id === order?.clientId);
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AppointmentEvent[]>([]);
  const [tool, setTool] = useState('');
  const [summary, setSummary] = useState('');
  const [newDate, setNewDate] = useState(appointment.date);
  const [newTime, setNewTime] = useState(appointment.time);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!liveMode) return;
      if (appointment.mode === 'Remoto') void fetch(`/api/appointments/${appointment.id}/remote-session`).then(async response => {
        if (!response.ok) return;
        const result = await response.json() as { data?: Session | null };
        setSession(result.data ?? null);
        setTool(result.data?.tool_name ?? '');
        setSummary(result.data?.summary ?? '');
      });
      void fetch(`/api/appointments/${appointment.id}/events`).then(async response => {
        if (!response.ok) return;
        const result = await response.json() as { data?: AppointmentEvent[] };
        setEvents(result.data ?? []);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [appointment.id, appointment.mode, liveMode]);
  async function saveSession(action?: 'started' | 'ended') {
    if (!liveMode) return notify('Conecte o Supabase para registrar a execução.', true);
    setBusy(true);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/remote-session`, { method: session ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session ? { started: action === 'started', ended: action === 'ended', summary } : { toolName: tool, summary }) });
      const result = await response.json() as { data?: Session; error?: string };
      if (!response.ok) return notify(result.error ?? 'Não foi possível atualizar a sessão.', true);
      setSession(result.data ?? null); notify(action === 'started' ? 'Sessão iniciada.' : action === 'ended' ? 'Sessão encerrada e resumo salvo.' : 'Autorização da sessão registrada.');
      onUpdated();
    } finally { setBusy(false); }
  }
  async function updateAppointment(patch: Record<string, unknown>, message: string) {
    if (!liveMode) return notify('Conecte o Supabase para registrar a execução.', true);
    setBusy(true);
    try { const response = await fetch(`/api/appointments/${appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); const result = await response.json() as { error?: string }; if (!response.ok) return notify(result.error ?? 'Não foi possível atualizar o compromisso.', true); notify(message); onUpdated(); close(); } finally { setBusy(false); }
  }
  function reschedule() {
    const start = new Date(`${newDate}T${newTime}:00`);
    const end = new Date(start.getTime() + appointment.duration * 60000);
    if (Number.isNaN(start.getTime())) return notify('Informe uma data e horário válidos.', true);
    void updateAppointment({ startAt: start.toISOString(), endAt: end.toISOString() }, 'Compromisso reagendado.');
  }
  return <><div className="drawer-backdrop" onClick={close} /><aside className="order-drawer"><header><div><span className="eyebrow">Agenda · execução</span><h2>{appointment.title}</h2></div><button className="icon-button" aria-label="Fechar detalhes" onClick={close}><X size={20} /></button></header><div className="drawer-scroll"><div className="drawer-title-row"><span className={`status-pill status-${appointment.mode === 'Remoto' ? 'blue' : 'green'}`}><span className="status-dot" />{appointment.mode}</span><span className="mode-pill"><Clock3 size={14} />{appointment.time} · {appointment.duration} min</span></div><div className="drawer-client"><div className="avatar">{(client?.name ?? 'C').slice(0, 1)}</div><div><b>{client?.name ?? 'Cliente'}</b><span>{order?.number ?? 'OS vinculada'} · {appointment.address || 'Atendimento na unidade'}</span></div></div><div className="drawer-section"><div className="section-label"><Clock3 size={16} /> Reagendar</div><div className="form-grid"><label>Data<input type="date" value={newDate} onChange={event => setNewDate(event.target.value)} /></label><label>Horário<input type="time" value={newTime} onChange={event => setNewTime(event.target.value)} /></label></div><button className="button secondary compact" disabled={busy} onClick={reschedule}>Salvar novo horário</button></div><div className="drawer-section"><div className="section-label">{appointment.mode === 'Domicílio' ? <Home size={16} /> : <Laptop size={16} />} Detalhes da execução</div>{appointment.mode === 'Remoto' ? <><label className="full-label">Ferramenta utilizada<input value={tool} onChange={event => setTool(event.target.value)} placeholder="Ex.: RustDesk ou Meet" disabled={Boolean(session)} /></label>{session?.authorization_at && <div className="form-hint">Autorização registrada em {new Date(session.authorization_at).toLocaleString('pt-BR')}</div>}{!session && <button className="button primary" disabled={busy || !tool.trim()} onClick={() => void saveSession()}>Registrar autorização</button>}{session && !session.started_at && <button className="button primary" disabled={busy} onClick={() => void saveSession('started')}>Iniciar sessão</button>}{session?.started_at && !session.ended_at && <><label className="full-label">Resumo técnico<textarea rows={4} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Descreva diagnóstico e orientação" /></label><button className="button primary" disabled={busy} onClick={() => void saveSession('ended')}><Check size={16} /> Encerrar sessão</button></>}{session?.ended_at && <div className="contact-note"><b>Sessão encerrada</b><p>{session.summary || 'Sem resumo informado.'}</p></div>}</> : <div className="detail-grid"><span><small>Endereço</small><b>{appointment.address || 'Não informado'}</b></span><span><small>Taxa</small><b>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0)}</b></span></div>}</div>{appointment.mode === 'Domicílio' && <div className="drawer-section"><div className="section-label"><Home size={16} /> Visita</div><div className="form-hint">Registre a chegada no endereço e finalize após a saída.</div><div className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => void updateAppointment({ checkedIn: true, status: 'confirmed' }, 'Chegada registrada.')}>Registrar chegada</button><button className="button primary" disabled={busy} onClick={() => void updateAppointment({ checkedOut: true, status: 'completed' }, 'Visita concluída.')}>Concluir visita</button></div></div>}<div className="drawer-section"><div className="section-label"><Clock3 size={16} /> Histórico</div>{events.length ? <div className="timeline">{events.map(event => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><b>{event.description}</b><small>{new Date(event.created_at).toLocaleString('pt-BR')}</small></div></div>)}</div> : <div className="empty-note">Nenhum evento registrado ainda.</div>}</div></div><footer className="drawer-footer"><button className="button secondary" onClick={close}>Fechar</button></footer></aside></>;
}
