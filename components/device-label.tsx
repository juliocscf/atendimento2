'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

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
    <style jsx>{`@page{size:auto;margin:0}.label-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:32px}.label-toolbar{max-width:520px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:center}.label-toolbar a{color:#2458d6;text-decoration:none;font-size:14px}.label-toolbar button{border:0;border-radius:10px;background:#2458d6;color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.device-label{box-sizing:border-box;width:520px;max-width:100%;margin:0 auto;background:#fff;border:1px solid #dbe2ee;border-radius:18px;padding:28px;box-shadow:0 16px 40px #1d35570f}.device-label-brand{display:flex;align-items:center;gap:10px}.device-label-brand small,.device-label-brand b{display:block}.device-label-brand small{font-size:10px;color:#64748b;margin-top:2px}.small-mark{width:30px!important;height:30px!important;font-size:16px!important}.device-label-content{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:26px;border-top:1px solid #e6ebf3;padding-top:24px}.label-caption,.label-kind{display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.device-label-content strong{display:block;font-size:56px;line-height:1;color:#2458d6;letter-spacing:.08em;margin:8px 0 12px}.label-kind{color:#172033;font-size:13px;text-transform:none;letter-spacing:0}.device-label-content img,.qr-placeholder{width:132px;height:132px;border-radius:8px}.qr-placeholder{background:repeating-linear-gradient(45deg,#172033 0 3px,#fff 3px 6px)}.device-label-details{display:grid;gap:5px;margin-top:24px}.device-label-details b{font-size:18px}.device-label-details span,.device-label-details small{color:#64748b}.device-label-note{border-top:1px dashed #dbe2ee;margin:24px 0 0;padding-top:14px;color:#64748b;font-size:11px}@media print{.label-page{background:#fff;padding:0}.label-toolbar{display:none}.device-label{box-shadow:none;border:1px solid #172033;margin:0;border-radius:0;width:90mm;padding:8mm}.device-label-content strong{font-size:42px}}`}</style>
  </main>;
}
