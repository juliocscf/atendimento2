'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { type Appointment, type DemoData, normalize } from '@/lib/demo';

type Props = {
  data: DemoData;
  clientName: (id: string) => string;
  appointmentsOverride?: Appointment[] | null;
  onNew: () => void;
  onSelect?: (appointment: Appointment) => void;
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const shift = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export function AgendaView({ data, clientName, appointmentsOverride, onNew, onSelect }: Props) {
  const [day, setDay] = useState(today);
  const appointments = (appointmentsOverride ?? data.appointments).filter(item => item.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const dayDate = new Date(`${day}T12:00:00Z`);
  const startOfWeek = shift(day, -(dayDate.getUTCDay() + 6) % 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => shift(startOfWeek, index));
  const dayLabel = dayDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  const monthLabel = dayDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const clientFor = (appointment: Appointment) => clientName(data.orders.find(order => order.id === appointment.orderId)?.clientId ?? '');

  return <div className="view-stack">
    <div className="agenda-toolbar"><div className="date-navigation">
      <button className="icon-button" onClick={() => setDay(shift(day, -1))} aria-label="Dia anterior"><ChevronLeft size={17} /></button>
      <div><b>{day === today() ? 'Hoje' : dayLabel}</b><span>{dayLabel}</span></div>
      <button className="icon-button" onClick={() => setDay(shift(day, 1))} aria-label="Próximo dia"><ChevronRight size={17} /></button>
      <input aria-label="Escolher data da agenda" type="date" value={day} onChange={event => setDay(event.target.value)} />
    </div><div className="toolbar-actions"><button className="button primary" onClick={onNew}><Plus size={17} /> Novo compromisso</button></div></div>
    <div className="agenda-layout"><section className="panel calendar-panel">
      <div className="calendar-head"><div><b>{monthLabel}</b><span>Agenda da equipe</span></div><div>
        <button className="icon-button" onClick={() => setDay(today())} aria-label="Voltar para hoje"><CalendarDays size={17} /></button>
      </div></div>
      <div className="week-grid">{weekDays.map(weekDay => {
        const label = new Date(`${weekDay}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');
        return <button key={weekDay} className={day === weekDay ? 'active' : ''} onClick={() => setDay(weekDay)}><span>{label}</span><b>{Number(weekDay.slice(-2))}</b></button>;
      })}</div>
      <div className="calendar-body">{Array.from({ length: 14 }, (_, hour) => hour + 7).map(hour => {
        const label = `${String(hour).padStart(2, '0')}:00`;
        return <div className="calendar-row" key={label}><span>{label}</span><div className="calendar-slot">
          {appointments.filter(item => Number(item.time.slice(0, 2)) === hour).map(item => <button className={`calendar-event ${normalize(item.mode)}`} key={item.id} onClick={() => onSelect?.(item)}><b>{item.time} · {item.title}</b><span>{item.technician} · {item.duration} min</span></button>)}
        </div></div>;
      })}{!appointments.length && <div className="calendar-empty"><CalendarDays size={22} />Nenhum compromisso neste dia.</div>}</div>
    </section><aside className="panel day-summary"><div className="panel-header"><div><h3>Resumo do dia</h3><span>{appointments.length} compromisso{appointments.length === 1 ? '' : 's'}</span></div></div>
      {appointments.map(item => <button type="button" className="summary-event" key={item.id} onClick={() => onSelect?.(item)}><span className={`summary-time ${normalize(item.mode)}`}>{item.time}</span><div><b>{item.title}</b><span>{clientFor(item)}</span><small>{item.technician} · {item.mode}</small></div></button>)}
      <button className="add-dashed" onClick={onNew}><Plus size={16} /> Novo compromisso</button>
    </aside></div>
  </div>;
}
