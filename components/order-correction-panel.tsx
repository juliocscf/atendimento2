'use client';

import { useState } from 'react';
import { type Device, type Order, statuses } from '@/lib/demo';

export function OrderCorrectionPanel({ order, devices, liveMode, onUpdated, close, notify, onDemoChange }: {
  order: Order;
  devices: Device[];
  liveMode: boolean;
  onUpdated?: () => void;
  close: () => void;
  notify: (message: string, error?: boolean) => void;
  onDemoChange: (change: { status?: Order['status']; issue?: string; priority?: string; due?: string; accessories?: string; deviceId?: string }, description: string) => void;
}) {
  const [mode, setMode] = useState<'none' | 'return' | 'edit'>('none');
  const [reason, setReason] = useState('');
  const [issue, setIssue] = useState(order.issue);
  const [priority, setPriority] = useState(order.priority);
  const [due, setDue] = useState(order.due || '');
  const [accessories, setAccessories] = useState(order.accessories || '');
  const [deviceId, setDeviceId] = useState(order.deviceId || '');
  const [saving, setSaving] = useState(false);
  const index = statuses.indexOf(order.status);
  const previous = index > 0 ? order.status === 'Concluído' && order.mode !== 'Balcão' ? 'Em testes' : statuses[index - 1] : null;
  const editable = order.status === 'Recebido' || order.status === 'Diagnóstico';

  async function save(action: 'return' | 'edit') {
    if (action === 'return' && reason.trim().length < 5) return notify('Informe o motivo da volta (mínimo de 5 caracteres).', true);
    if (action === 'edit' && issue.trim().length < 8) return notify('Descreva o problema em pelo menos 8 caracteres.', true);
    setSaving(true);
    const description = action === 'return' ? `Etapa retornada para ${previous}. Motivo: ${reason.trim()}` : 'Dados da solicitação editados.';
    try {
      if (liveMode) {
        const response = await fetch(`/api/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'return' ? { action, note: reason.trim() } : { action, issue: issue.trim(), priority, dueDate: due || null, accessories, deviceId: deviceId || null }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) return notify(result.error ?? 'Não foi possível atualizar a OS.', true);
        notify(action === 'return' ? `OS retornada para ${previous}.` : 'Solicitação atualizada.');
        onUpdated?.();
        close();
      } else {
        onDemoChange(action === 'return' ? { status: previous! } : { issue: issue.trim(), priority, due, accessories, deviceId }, description);
        close();
      }
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <section className="drawer-section order-correction-panel" aria-label="Corrigir ordem de serviço">
    <div className="section-label">Corrigir atendimento</div>
    {mode === 'none' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {previous && <button className="button secondary compact" onClick={() => setMode('return')}>Voltar para {previous}</button>}
      {editable && <button className="button secondary compact" onClick={() => setMode('edit')}>Editar solicitação</button>}
      {!editable && <small>Para alterar problema ou equipamento, volte até Diagnóstico.</small>}
    </div>}
    {mode === 'return' && <div style={{ display: 'grid', gap: 10 }}>
      <p>Retornar de <b>{order.status}</b> para <b>{previous}</b>.</p>
      {order.status === 'Aguardando aprovação' && <p>Se já houve proposta enviada, o link anterior será revogado e uma nova versão ficará em rascunho. Será preciso enviá-la para nova aprovação.</p>}
      <label>Motivo da correção<textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} placeholder="Descreva o que precisa ser corrigido" /></label>
      <div style={{ display: 'flex', gap: 8 }}><button className="button secondary compact" onClick={() => setMode('none')}>Cancelar</button><button className="button primary compact" disabled={saving} onClick={() => void save('return')}>{saving ? 'Salvando…' : 'Confirmar retorno'}</button></div>
    </div>}
    {mode === 'edit' && <div style={{ display: 'grid', gap: 10 }}>
      <label>Problema relatado<textarea value={issue} onChange={event => setIssue(event.target.value)} rows={3} /></label>
      <label>Equipamento<select value={deviceId} onChange={event => setDeviceId(event.target.value)}><option value="">Sem equipamento vinculado</option>{devices.filter(device => device.clientId === order.clientId).map(device => <option key={device.id} value={device.id}>{device.brand} {device.model} · {device.code}</option>)}</select></label>
      <label>Prioridade<select value={priority} onChange={event => setPriority(event.target.value)}><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
      <label>Prazo estimado<input type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
      <label>Acessórios<input value={accessories} onChange={event => setAccessories(event.target.value)} /></label>
      <div style={{ display: 'flex', gap: 8 }}><button className="button secondary compact" onClick={() => setMode('none')}>Cancelar</button><button className="button primary compact" disabled={saving} onClick={() => void save('edit')}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </div>}
  </section>;
}
