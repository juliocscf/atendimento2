'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2, MessageCircle, Printer, QrCode, RefreshCcw, Unlink } from 'lucide-react';
import QRCode from 'qrcode';

type LinkState = {
  active: boolean;
  created_at: string;
  expires_at: string | null;
  last_accessed_at: string | null;
};

export function OrderTrackingPanel({ orderId, orderNumber, liveMode, notify }: { orderId: string; orderNumber: string; liveMode: boolean; notify: (message: string, error?: boolean) => void }) {
  const [state, setState] = useState<LinkState | null>(null);
  const [url, setUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!liveMode) return;
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking-link`);
      if (!response.ok) return;
      const result = await response.json() as { data?: LinkState | null };
      setState(result.data ?? null);
    } catch {
      // This optional panel must not block the order drawer.
    }
  }, [liveMode, orderId]);

  useEffect(() => {
    const savedUrl = localStorage.getItem(`nexo:tracking:${orderId}`);
    if (savedUrl) {
      setUrl(savedUrl);
      void QRCode.toDataURL(savedUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).then(setQrCode);
    }
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function generate() {
    if (!liveMode || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking-link`, { method: 'POST' });
      const result = await response.json() as { data?: { url: string; created_at: string; expires_at: string | null }; error?: string };
      if (!response.ok || !result.data?.url) {
        notify(result.error ?? 'Não foi possível gerar o link de acompanhamento.', true);
        return;
      }
      setUrl(result.data.url);
      localStorage.setItem(`nexo:tracking:${orderId}`, result.data.url);
      setQrCode(await QRCode.toDataURL(result.data.url, { width: 220, margin: 1, errorCorrectionLevel: 'M' }));
      setState({ active: true, created_at: result.data.created_at, expires_at: result.data.expires_at, last_accessed_at: null });
      await navigator.clipboard.writeText(result.data.url).catch(() => undefined);
      notify('Link de acompanhamento gerado e copiado.');
    } catch {
      notify('Não foi possível conectar ao servidor.', true);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); notify('Link de acompanhamento copiado.'); }
    catch { notify('Não foi possível copiar automaticamente. Selecione o endereço exibido.', true); }
  }

  async function copyMessage() {
    if (!url) return;
    const message = `Olá, sua ordem de serviço ${orderNumber} foi registrada. Acompanhe o atendimento pelo link: ${url}. Guarde este endereço, pois ele permite consultar o andamento do seu equipamento.`;
    try { await navigator.clipboard.writeText(message); notify('Mensagem para o cliente copiada.'); }
    catch { notify('Não foi possível copiar a mensagem.', true); }
  }

  async function revoke() {
    if (!state?.active || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking-link`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) { notify(result.error ?? 'Não foi possível cancelar o link.', true); return; }
      setState(null); setUrl(''); setQrCode('');
      localStorage.removeItem(`nexo:tracking:${orderId}`);
      notify('Acesso de acompanhamento cancelado.');
    } finally {
      setBusy(false);
    }
  }

  if (!liveMode) return <div className="drawer-section"><div className="section-label"><Link2 size={16} /> Acompanhamento do cliente</div><div className="empty-note">O link público fica disponível quando a OS está conectada ao Supabase.</div></div>;

  return <div className="drawer-section tracking-admin">
    <div className="section-label"><Link2 size={16} /> Acompanhamento do cliente</div>
    <div className="tracking-admin-status"><span className={state?.active ? 'active' : ''} /> <b>{state?.active ? 'Link ativo' : 'Nenhum link ativo'}</b>{state?.last_accessed_at && <small>Último acesso em {new Date(state.last_accessed_at).toLocaleString('pt-BR')}</small>}</div>
    {!url && state?.active && <p className="tracking-admin-help">Por segurança, o endereço não fica armazenado. Gere um novo link para copiar ou imprimir outro QR Code; o anterior será cancelado.</p>}
    {!url && <button className="button secondary" disabled={busy} onClick={() => void generate()}>{busy ? 'Gerando…' : state?.active ? <><RefreshCcw size={15} /> Gerar novo link</> : <><QrCode size={15} /> Gerar link e QR Code</>}</button>}
    {url && <div className="tracking-admin-result">
      {qrCode && <Image src={qrCode} alt={`QR Code de acompanhamento da ${orderNumber}`} width={150} height={150} unoptimized />}
      <div><label>Link do cliente<input readOnly value={url} onFocus={event => event.currentTarget.select()} /></label><div className="tracking-admin-actions"><button className="button secondary compact" onClick={() => void copyLink()}><Copy size={14} /> Copiar link</button><button className="button secondary compact" onClick={() => void copyMessage()}><MessageCircle size={14} /> Copiar mensagem</button><Link className="button secondary compact" href={url} target="_blank"><ExternalLink size={14} /> Abrir</Link><Link className="button secondary compact" href={`/ordens/${orderId}/comprovante?acompanhamento=${encodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '')}`} target="_blank"><Printer size={14} /> Imprimir com QR</Link></div></div>
    </div>}
    {state?.active && <button className="text-button tracking-revoke" disabled={busy} onClick={() => void revoke()}><Unlink size={14} /> Cancelar acesso do cliente</button>}
    <style>{`.tracking-admin-status{display:flex;align-items:center;gap:7px;margin-bottom:10px}.tracking-admin-status>span{width:9px;height:9px;border-radius:50%;background:#94a3b8}.tracking-admin-status>span.active{background:#22a06b}.tracking-admin-status small{margin-left:auto;color:#64748b}.tracking-admin-help{color:#64748b;font-size:12px;line-height:1.5}.tracking-admin-result{display:grid;grid-template-columns:150px 1fr;gap:15px;align-items:center}.tracking-admin-result img{border:1px solid #dbe2ee;border-radius:10px}.tracking-admin-result label{display:grid;gap:6px;font-size:12px;color:#64748b}.tracking-admin-result input{width:100%;box-sizing:border-box}.tracking-admin-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.tracking-revoke{display:flex;align-items:center;gap:6px;margin-top:12px;color:#b42318}@media(max-width:560px){.tracking-admin-result{grid-template-columns:1fr}.tracking-admin-result img{margin:auto}.tracking-admin-status{flex-wrap:wrap}.tracking-admin-status small{width:100%;margin-left:16px}}`}</style>
  </div>;
}
