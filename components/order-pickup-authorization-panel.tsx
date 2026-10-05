'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, ClipboardCopy, PackageCheck, ShieldCheck, UserCheck, X } from 'lucide-react';
import { formatCpf, type PickupAuthorizationStaffState } from '@/lib/pickup-authorization';

function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function OrderPickupAuthorizationPanel({ orderId, orderNumber, liveMode, notify, onCompleted }: { orderId: string; orderNumber: string; liveMode: boolean; notify: (message: string, error?: boolean) => void; onCompleted?: () => void }) {
  const [state, setState] = useState<PickupAuthorizationStaffState | null>(null);
  const [cpf, setCpf] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!liveMode) return;
    try {
      const response = await fetch(`/api/orders/${orderId}/pickup-authorization`, { cache: 'no-store' });
      const result = await response.json() as { data?: PickupAuthorizationStaffState; error?: string };
      if (response.ok && result.data) setState(result.data);
    } catch { /* optional panel remains isolated */ }
  }, [liveMode, orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/pickup-authorization`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { notify(result.error ?? 'Não foi possível atualizar a autorização.', true); return false; }
      await load();
      return true;
    } catch {
      notify('Não foi possível conectar ao servidor.', true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    const authorization = state?.authorization;
    if (!authorization?.verification_code) return;
    const message = `Código de confirmação para autorizar a retirada da ${orderNumber}: ${authorization.verification_code}. Válido até ${dateTime(authorization.code_expires_at)}. Não compartilhe com outras pessoas.`;
    try { await navigator.clipboard.writeText(message); notify('Mensagem com o código copiada.'); }
    catch { notify('Não foi possível copiar a mensagem.', true); }
  }

  async function collect() {
    if (!(await action({ action: 'collect', cpf }))) return;
    notify('Retirada registrada e ordem de serviço concluída.');
    setCpf('');
    onCompleted?.();
  }

  if (!liveMode) return null;

  const authorization = state?.authorization;
  return <div className="drawer-section pickup-admin">
    <div className="section-label"><UserCheck size={16} /> Retirada por terceiros</div>
    {!state && <div className="empty-note">Carregando configuração…</div>}
    {state && <>
      <div className="pickup-admin-setting"><span><b>{state.feature_enabled ? 'Recurso habilitado' : 'Recurso desabilitado'}</b><small>{state.order_blocked ? 'Bloqueado especificamente nesta OS.' : state.feature_enabled ? 'Disponível quando a OS estiver pronta para entrega.' : 'Ative em Configurações → Segurança.'}</small></span>{state.is_manager && state.feature_enabled && <button type="button" className={`toggle ${!state.order_blocked ? 'on' : ''}`} aria-label={`${state.order_blocked ? 'Liberar' : 'Bloquear'} retirada por terceiros nesta OS`} aria-pressed={!state.order_blocked} disabled={busy} onClick={() => void action({ action: 'block', blocked: !state.order_blocked })}><span /></button>}</div>

      {state.feature_enabled && !state.order_blocked && state.order_status !== 'Pronto para entrega' && !authorization && <div className="empty-note">A autorização ficará disponível quando a OS estiver em Pronto para entrega.</div>}

      {authorization?.status === 'requested' && <div className="pickup-admin-card warning"><div><b>Aguardando confirmação do cliente</b><p>{authorization.authorized_name} · CPF final {authorization.cpf_last4}</p><small>Canal: {authorization.delivery_channel === 'email' ? 'e-mail' : 'WhatsApp'} · {authorization.contact_mask}</small></div>{authorization.verification_code ? <div className="pickup-code"><span>{authorization.verification_code}</span><button className="button secondary compact" onClick={() => void copyCode()}><ClipboardCopy size={14} /> Copiar mensagem</button><small>Válido até {dateTime(authorization.code_expires_at)}</small></div> : <small>O código expirou ou não está disponível.</small>}<button className="pickup-admin-cancel" disabled={busy} onClick={() => void action({ action: 'cancel', reason: 'Cancelada pela assistência.' })}><X size={14} /> Cancelar solicitação</button></div>}

      {authorization?.status === 'confirmed' && <div className="pickup-admin-card confirmed"><div className="pickup-admin-title"><Check size={18} /><span><b>Autorização confirmada</b><small>Confirmada em {authorization.confirmed_at ? dateTime(authorization.confirmed_at) : 'data não informada'}</small></span></div><p><strong>{authorization.authorized_name}</strong><br />CPF final {authorization.cpf_last4}</p><div className="pickup-document-warning"><ShieldCheck size={16} /> Confira o documento oficial com foto e digite o CPF apresentado.</div><label>CPF apresentado<input value={formatCpf(cpf)} onChange={event => setCpf(event.target.value)} inputMode="numeric" placeholder="000.000.000-00" /></label><button className="button primary" disabled={busy || cpf.replace(/\D/g, '').length !== 11} onClick={() => void collect()}><PackageCheck size={15} /> {busy ? 'Registrando…' : 'Confirmar retirada e concluir OS'}</button><button className="pickup-admin-cancel" disabled={busy} onClick={() => void action({ action: 'cancel', reason: 'Cancelada pela assistência.' })}><Ban size={14} /> Cancelar autorização</button></div>}

      {authorization?.status === 'collected' && <div className="pickup-admin-card collected"><Check size={18} /><div><b>Retirada registrada</b><p>{authorization.authorized_name} retirou o equipamento em {authorization.collected_at ? dateTime(authorization.collected_at) : 'data não informada'}.</p></div></div>}

      {(authorization?.status === 'cancelled' || authorization?.status === 'expired') && <div className="empty-note">Última autorização {authorization.status === 'expired' ? 'expirada' : 'cancelada'}. {authorization.cancellation_reason ?? ''}</div>}
    </>}
    <style>{`.pickup-admin-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.pickup-admin-setting span:first-child{display:grid;gap:3px}.pickup-admin-setting small{color:#64748b}.pickup-admin-card{display:grid;gap:10px;border:1px solid #dbe2ee;border-radius:12px;padding:13px}.pickup-admin-card.warning{background:#fffaf0;border-color:#f1d59a}.pickup-admin-card.confirmed{background:#f4fbf7;border-color:#b9e3ca}.pickup-admin-card.collected{display:flex;background:#edf8f1;border-color:#b9e3ca;color:#187247}.pickup-admin-card p{margin:0;line-height:1.5}.pickup-admin-card small{color:#64748b}.pickup-code{display:grid;gap:7px;justify-items:start}.pickup-code>span{font:800 24px/1 monospace;letter-spacing:.18em;color:#172033}.pickup-admin-cancel{display:flex;align-items:center;gap:5px;width:max-content;border:0;background:none;color:#b42318;font-weight:700;padding:4px 0;cursor:pointer}.pickup-admin-title{display:flex;align-items:center;gap:8px;color:#187247}.pickup-admin-title span{display:grid}.pickup-document-warning{display:flex;align-items:center;gap:7px;color:#466354;font-size:12px}.pickup-admin-card label{display:grid;gap:5px;font-size:12px;color:#64748b}.pickup-admin-card input{width:100%;box-sizing:border-box}`}</style>
  </div>;
}
