'use client';

import { useState } from 'react';
import { Check, ShieldCheck, UserCheck, X } from 'lucide-react';
import { formatCpf, type PickupAuthorizationPublic } from '@/lib/pickup-authorization';

function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function PickupAuthorizationPortal({ token, available, initialAuthorization }: { token: string; available: boolean; initialAuthorization: PickupAuthorizationPublic | null }) {
  const [authorization, setAuthorization] = useState(initialAuthorization);
  const [authorizedName, setAuthorizedName] = useState('');
  const [cpf, setCpf] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openedAt] = useState(() => Date.now());
  const requestExpired = authorization?.status === 'requested' && new Date(authorization.code_expires_at).getTime() <= openedAt;
  const active = (authorization?.status === 'requested' && !requestExpired) || authorization?.status === 'confirmed';

  if (!available && !authorization) return null;

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/portal/orders/${token}/pickup-authorization`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { data?: PickupAuthorizationPublic | { verified: boolean; expired?: boolean; attempts_remaining?: number; status?: 'confirmed'; confirmed_at?: string; expires_at?: string } | boolean; error?: string };
      if (!response.ok) { setError(result.error ?? 'Não foi possível concluir a solicitação.'); return null; }
      return result.data;
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function requestAuthorization(event: React.FormEvent) {
    event.preventDefault();
    const result = await submit({ action: 'request', authorizedName, cpf, deliveryChannel: channel });
    if (result && typeof result === 'object' && 'authorized_name' in result) {
      setAuthorization(result as PickupAuthorizationPublic);
      setCode('');
    }
  }

  async function verify() {
    const result = await submit({ action: 'verify', code });
    if (!result || typeof result !== 'object' || !('verified' in result)) return;
    if (result.verified) {
      setAuthorization(current => current ? { ...current, status: 'confirmed', confirmed_at: result.confirmed_at ?? new Date().toISOString(), expires_at: result.expires_at ?? null } : current);
      setCode('');
    } else if (result.expired) {
      setAuthorization(current => current ? { ...current, status: 'expired' } : current);
      setError('O código expirou. Faça uma nova solicitação.');
    } else {
      setAuthorization(current => current ? { ...current, verification_attempts: 3 - (result.attempts_remaining ?? 0), status: (result.attempts_remaining ?? 0) === 0 ? 'cancelled' : current.status } : current);
      setError(`Código incorreto. Restam ${result.attempts_remaining ?? 0} tentativa(s).`);
    }
  }

  async function cancel() {
    const result = await submit({ action: 'cancel' });
    if (result === true) setAuthorization(current => current ? { ...current, status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Cancelada pelo cliente.' } : current);
  }

  return <section className="pickup-portal">
    <div className="tracking-section-title"><UserCheck size={18} /><div><h2>Retirada por outra pessoa</h2><p>Autorize uma pessoa de confiança a retirar o equipamento.</p></div></div>

    {authorization?.status === 'requested' && !requestExpired && <div className="pickup-state">
      <b>Código de confirmação aguardado</b>
      <p>A assistência enviará o código para {authorization.contact_mask}. Ele é válido até {dateTime(authorization.code_expires_at)}.</p>
      <label>Código de seis dígitos<input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label>
      <button className="tracking-primary" disabled={busy || code.length !== 6} onClick={() => void verify()}>{busy ? 'Verificando…' : 'Confirmar autorização'}</button>
      <button className="pickup-cancel" disabled={busy} onClick={() => void cancel()}><X size={14} /> Cancelar solicitação</button>
    </div>}

    {authorization?.status === 'confirmed' && <div className="pickup-confirmed"><Check size={20} /><div><b>Retirada autorizada</b><p><strong>{authorization.authorized_name}</strong> · CPF final {authorization.cpf_last4}</p><small>Válida até {authorization.expires_at ? dateTime(authorization.expires_at) : 'a entrega'}. A pessoa deverá apresentar documento oficial com foto.</small></div><button className="pickup-cancel" disabled={busy} onClick={() => void cancel()}>Cancelar autorização</button></div>}

    {authorization?.status === 'collected' && <div className="pickup-confirmed"><Check size={20} /><div><b>Equipamento retirado</b><p>Retirada por {authorization.authorized_name} em {authorization.collected_at ? dateTime(authorization.collected_at) : 'data não informada'}.</p></div></div>}

    {!active && authorization?.status !== 'collected' && available && <form className="pickup-form" onSubmit={requestAuthorization}>
      {authorization && <div className="pickup-previous">A autorização anterior foi {authorization.status === 'expired' || requestExpired ? 'expirada' : 'cancelada'}. Você pode fazer uma nova solicitação.</div>}
      <label>Nome completo da pessoa autorizada<input value={authorizedName} onChange={event => setAuthorizedName(event.target.value)} minLength={3} maxLength={120} required /></label>
      <label>CPF da pessoa autorizada<input value={formatCpf(cpf)} onChange={event => setCpf(event.target.value)} inputMode="numeric" placeholder="000.000.000-00" required /></label>
      <label>Receber confirmação por<select value={channel} onChange={event => setChannel(event.target.value as 'whatsapp' | 'email')}><option value="whatsapp">WhatsApp cadastrado</option><option value="email">E-mail cadastrado</option></select></label>
      <div className="pickup-security"><ShieldCheck size={16} /> O CPF será protegido e usado somente para conferência na retirada.</div>
      <button className="tracking-primary" disabled={busy}>{busy ? 'Solicitando…' : 'Solicitar autorização'}</button>
    </form>}

    {!available && authorization?.status !== 'collected' && <div className="pickup-previous">Novas autorizações estão indisponíveis para esta ordem.</div>}
    {error && <div className="tracking-error" role="alert">{error}</div>}
    <style>{`.pickup-portal{border:1px solid #dbe5ff;background:#f8faff;border-radius:15px;padding:18px;margin-top:14px}.pickup-state,.pickup-form{display:grid;gap:11px;margin-top:15px}.pickup-state p,.pickup-confirmed p{margin:3px 0;color:#475569}.pickup-state label,.pickup-form label{display:grid;gap:6px;font-size:12px;color:#64748b;font-weight:700}.pickup-state input,.pickup-form input,.pickup-form select{box-sizing:border-box;width:100%;border:1px solid #cfd8e8;border-radius:10px;padding:11px;background:#fff;color:#172033}.pickup-cancel{display:flex;align-items:center;justify-content:center;gap:5px;border:0;background:none;color:#b42318;font-weight:700;padding:9px;cursor:pointer}.pickup-confirmed{display:flex;align-items:flex-start;gap:10px;background:#e9f8ef;color:#187247;border-radius:11px;padding:14px;margin-top:14px}.pickup-confirmed>div{flex:1}.pickup-confirmed small{display:block;color:#466354;margin-top:5px}.pickup-previous{background:#fff5e8;color:#8a4b08;border-radius:10px;padding:11px;font-size:12px}.pickup-security{display:flex;align-items:center;gap:7px;color:#475569;font-size:12px}`}</style>
  </section>;
}
