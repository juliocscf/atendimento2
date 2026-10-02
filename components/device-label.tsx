'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';

type DeviceLabelProps = {
  device: { id: string; code: string; kind: string; brand: string; model: string; serial: string | null };
  clientName: string;
};

export function DeviceLabel({ device, clientName }: DeviceLabelProps) {
  const [qrCode, setQrCode] = useState('');
  useEffect(() => {
    const url = `${window.location.origin}/equipamentos/${device.id}/etiqueta`;
    void QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: 'M' }).then(setQrCode);
  }, [device.id]);

  return <main className="label-page">
    <div className="label-toolbar"><Link href="/equipamentos">← Voltar para equipamentos</Link><button type="button" onClick={() => window.print()}>Imprimir etiqueta</button></div>
    <section className="device-label" aria-label={`Etiqueta do equipamento ${device.code}`}>
      <div className="device-label-brand"><span className="brand-mark small-mark">N</span><span><b>Nexo</b><small>gestão da assistência</small></span></div>
      <div className="device-label-content"><div><span className="label-caption">Equipamento</span><strong>{device.code}</strong><span className="label-kind">{device.kind}</span></div>{qrCode ? <img src={qrCode} alt="QR Code para abrir a ficha do equipamento" /> : <div className="qr-placeholder" aria-hidden="true" />}</div>
      <div className="device-label-details"><b>{device.brand} {device.model}</b><span>{clientName}</span>{device.serial && <small>Série: {device.serial}</small>}</div>
      <p className="device-label-note">Acesso restrito à equipe autenticada</p>
    </section>
    <DevicePhotoPanel deviceId={device.id} />
    <style jsx>{`@page{size:auto;margin:0}.label-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:32px}.label-toolbar{max-width:520px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:center}.label-toolbar a{color:#2458d6;text-decoration:none;font-size:14px}.label-toolbar button{border:0;border-radius:10px;background:#2458d6;color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.device-label{box-sizing:border-box;width:520px;max-width:100%;margin:0 auto;background:#fff;border:1px solid #dbe2ee;border-radius:18px;padding:28px;box-shadow:0 16px 40px #1d35570f}.device-label-brand{display:flex;align-items:center;gap:10px}.device-label-brand small,.device-label-brand b{display:block}.device-label-brand small{font-size:10px;color:#64748b;margin-top:2px}.small-mark{width:30px!important;height:30px!important;font-size:16px!important}.device-label-content{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:26px;border-top:1px solid #e6ebf3;padding-top:24px}.label-caption,.label-kind{display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.device-label-content strong{display:block;font-size:56px;line-height:1;color:#2458d6;letter-spacing:.08em;margin:8px 0 12px}.label-kind{color:#172033;font-size:13px;text-transform:none;letter-spacing:0}.device-label-content img,.qr-placeholder{width:132px;height:132px;border-radius:8px}.qr-placeholder{background:repeating-linear-gradient(45deg,#172033 0 3px,#fff 3px 6px)}.device-label-details{display:grid;gap:5px;margin-top:24px}.device-label-details b{font-size:18px}.device-label-details span,.device-label-details small{color:#64748b}.device-label-note{border-top:1px dashed #dbe2ee;margin:24px 0 0;padding-top:14px;color:#64748b;font-size:11px}@media print{.label-page{background:#fff;padding:0}.label-toolbar{display:none}.device-label{box-shadow:none;border:1px solid #172033;margin:0;border-radius:0;width:90mm;padding:8mm}.device-label-content strong{font-size:42px}}`}</style>
  </main>;
}

function DevicePhotoPanel({ deviceId }: { deviceId: string }) {
  const [photos, setPhotos] = useState<Array<{ id: string; url: string | null; created_at: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const loadPhotos = useCallback(async () => {
    const response = await fetch(`/api/devices/${deviceId}/photos`);
    if (!response.ok) return;
    const result = await response.json() as { data?: Array<{ id: string; url: string | null; created_at: string }> };
    setPhotos(result.data ?? []);
  }, [deviceId]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadPhotos(); }, 0); return () => window.clearTimeout(timer); }, [loadPhotos]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setMessage('');
    const form = new FormData(); form.append('file', file);
    try {
      const response = await fetch(`/api/devices/${deviceId}/photos`, { method: 'POST', body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error ?? 'Não foi possível enviar a foto.'); return; }
      setMessage('Foto adicionada com segurança.'); await loadPhotos();
    } catch { setMessage('Não foi possível conectar ao servidor.'); }
    finally { setUploading(false); event.target.value = ''; }
  }
  return <section id="fotos" className="photo-panel"><div><span className="label-caption">Registro visual</span><h2>Fotos do equipamento</h2><p>Arquivos privados, disponíveis apenas para a equipe autorizada.</p></div><label className="photo-upload">{uploading ? 'Enviando…' : 'Adicionar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={uploading} /></label>{message && <small>{message}</small>}{photos.length > 0 && <div className="photo-grid">{photos.map(photo => photo.url && <img key={photo.id} src={photo.url} alt="Foto registrada do equipamento" />)}</div>} {!photos.length && <span className="photo-empty">Nenhuma foto registrada ainda.</span>}<style jsx>{`.photo-panel{max-width:520px;margin:20px auto 0;padding:22px;background:#fff;border:1px solid #dbe2ee;border-radius:18px}.photo-panel h2{margin:5px 0;font-size:18px}.photo-panel p{margin:0;color:#64748b;font-size:13px}.photo-upload{display:inline-flex;margin-top:18px;border-radius:10px;background:#172033;color:#fff;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer}.photo-upload input{display:none}.photo-panel small{display:block;color:#64748b;margin-top:8px}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}.photo-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px}.photo-empty{display:block;margin-top:16px;color:#94a3b8;font-size:13px}@media print{.photo-panel{display:none}}`}</style></section>;
}
