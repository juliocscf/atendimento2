'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type LabelDevice = { id: string; code: string; kind: string; brand: string; model: string; serial: string | null };

export function DeviceLabelSheet({ devices }: { devices: LabelDevice[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void Promise.all(devices.map(async device => [device.id, await QRCode.toDataURL(`${window.location.origin}/equipamentos/${device.id}/etiqueta`, { width: 160, margin: 0, errorCorrectionLevel: 'M' })] as const)).then(entries => { if (active) setCodes(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [devices]);
  const labels = [...devices, ...Array.from({ length: Math.max(0, 30 - devices.length) }, () => null)].slice(0, 30);
  return <main className="label-sheet-page"><div className="label-sheet-toolbar"><Link href="/equipamentos">← Voltar para equipamentos</Link><div><span>{devices.length} etiquetas preenchidas · Pimaco 6280</span><button type="button" onClick={() => window.print()}>Imprimir folha</button></div></div><section className="label-sheet" aria-label="Folha de etiquetas Pimaco 6280">{labels.map((device, index) => <div className="pimaco-label" key={device?.id ?? `empty-${index}`}>{device ? <><img src={codes[device.id] ?? ''} alt="" aria-hidden="true" /><div><strong>{device.code}</strong><b>{device.brand} {device.model}</b><span>{device.kind}{device.serial ? ` · ${device.serial}` : ''}</span></div></> : null}</div>)}</section><p className="label-sheet-note">Imprima em escala 100%, sem “ajustar à página”. Faça um teste em papel comum antes da folha adesiva.</p><style jsx>{`@page{size:A4;margin:0}.label-sheet-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:28px}.label-sheet-toolbar{max-width:900px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center;gap:18px}.label-sheet-toolbar a{color:#2458d6;text-decoration:none;font-size:14px}.label-sheet-toolbar div{display:flex;align-items:center;gap:12px}.label-sheet-toolbar span{color:#64748b;font-size:12px}.label-sheet-toolbar button{border:0;border-radius:10px;background:#2458d6;color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.label-sheet{box-sizing:border-box;width:210mm;height:297mm;margin:0 auto;padding-top:21.5mm;display:grid;grid-template-columns:repeat(3,66.7mm);grid-template-rows:repeat(10,25.4mm);justify-content:center;overflow:hidden;background:#fff;box-shadow:0 14px 35px #1d35571a}.pimaco-label{box-sizing:border-box;width:66.7mm;height:25.4mm;padding:2.5mm 2.2mm;display:flex;align-items:center;gap:2.2mm;overflow:hidden}.pimaco-label img{width:19mm;height:19mm;flex:none}.pimaco-label div{min-width:0;display:flex;flex-direction:column;gap:1mm;overflow:hidden}.pimaco-label strong{color:#2458d6;font-size:13pt;line-height:1;letter-spacing:.08em}.pimaco-label b,.pimaco-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pimaco-label b{font-size:7.5pt;line-height:1.1}.pimaco-label span{color:#64748b;font-size:6.5pt;line-height:1.1}.label-sheet-note{max-width:900px;margin:15px auto 0;color:#64748b;font-size:12px}@media print{.label-sheet-page{padding:0;background:#fff}.label-sheet-toolbar,.label-sheet-note{display:none}.label-sheet{margin:0;box-shadow:none}}`}</style></main>;
}
