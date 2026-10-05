'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

type LabelDevice = { id: string; code: string; kind: string; brand: string; model: string; serial: string | null };

export function DeviceLabelSheet({ devices }: { devices: LabelDevice[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [startPosition, setStartPosition] = useState(1);
  const [assignments, setAssignments] = useState<Array<string | null>>(() => Array.from({ length: 30 }, (_, index) => devices[index]?.id ?? null));
  useEffect(() => {
    let active = true;
    void Promise.all(devices.map(async device => [device.id, await QRCode.toDataURL(`${window.location.origin}/equipamentos/${device.id}/etiqueta`, { width: 160, margin: 0, errorCorrectionLevel: 'M' })] as const)).then(entries => { if (active) setCodes(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [devices]);
  const assignedDevices = useMemo(() => assignments.map(id => devices.find(device => device.id === id) ?? null), [assignments, devices]);
  function assign(position: number, deviceId: string) {
    setAssignments(current => current.map((id, index) => index === position ? (deviceId || null) : id === deviceId ? null : id));
  }
  function fillFromStart() {
    setAssignments(current => {
      const next = [...current];
      devices.forEach((device, index) => { const position = startPosition - 1 + index; if (position < 30) next[position] = device.id; });
      return next;
    });
  }
  function clearSheet() { setAssignments(Array.from({ length: 30 }, () => null)); }
  const filledCount = assignedDevices.filter(Boolean).length;
  return <main className="label-sheet-page"><div className="label-sheet-toolbar"><Link href="/equipamentos">← Voltar para equipamentos</Link><div><span>{filledCount} de 30 posições preenchidas</span><button type="button" onClick={() => window.print()}>Imprimir folha</button></div></div><section className="label-sheet-controls" aria-label="Escolha das posições"><div><b>Organize a folha</b><p>Escolha o equipamento em cada posição ou preencha automaticamente a partir de uma posição.</p></div><div className="label-sheet-actions"><label>Começar na posição<select value={startPosition} onChange={event => setStartPosition(Number(event.target.value))}>{Array.from({ length: 30 }, (_, index) => <option value={index + 1} key={index}>Posição {index + 1}</option>)}</select></label><button type="button" className="button secondary" onClick={fillFromStart}>Preencher automaticamente</button><button type="button" className="button secondary" onClick={clearSheet}>Limpar folha</button></div></section><section className="label-sheet" aria-label="Folha de etiquetas Pimaco 6280">{assignedDevices.map((device, index) => <div className="pimaco-label" key={`slot-${index}`}><select className="label-slot-picker" aria-label={`Equipamento da posição ${index + 1}`} value={device?.id ?? ''} onChange={event => assign(index, event.target.value)}><option value="">Posição {index + 1} · vazia</option>{devices.map(option => <option value={option.id} key={option.id}>{option.code} · {option.brand} {option.model}</option>)}</select>{device ? <><img src={codes[device.id] ?? ''} alt="" aria-hidden="true" /><div><strong>{device.code}</strong><b>{device.brand} {device.model}</b><span>{device.kind}{device.serial ? ` · ${device.serial}` : ''}</span></div></> : <span className="empty-label-slot">Posição {index + 1}</span>}</div>)}</section><p className="label-sheet-note">Imprima em escala 100%, sem “ajustar à página”. Faça um teste em papel comum antes da folha adesiva.</p><style jsx>{`@page{size:A4;margin:0}.label-sheet-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:28px}.label-sheet-toolbar{max-width:900px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center;gap:18px}.label-sheet-toolbar a{color:#2458d6;text-decoration:none;font-size:14px}.label-sheet-toolbar div{display:flex;align-items:center;gap:12px}.label-sheet-toolbar span{color:#64748b;font-size:12px}.label-sheet-toolbar button{border:0;border-radius:10px;background:#2458d6;color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.label-sheet-controls{max-width:900px;margin:0 auto 18px;padding:15px 17px;background:#fff;border:1px solid #dbe2ee;border-radius:12px;display:flex;justify-content:space-between;gap:18px;align-items:center}.label-sheet-controls b{font-size:13px}.label-sheet-controls p{margin:4px 0 0;color:#64748b;font-size:11px}.label-sheet-actions{display:flex;align-items:flex-end;gap:8px}.label-sheet-actions label{display:flex;flex-direction:column;gap:5px;color:#64748b;font-size:10px;font-weight:700}.label-sheet-actions select,.label-slot-picker{border:1px solid #dbe2ee;border-radius:7px;background:#fff;color:#41506a;padding:8px}.label-sheet{box-sizing:border-box;width:210mm;height:297mm;margin:0 auto;padding-top:21.5mm;display:grid;grid-template-columns:repeat(3,66.7mm);grid-template-rows:repeat(10,25.4mm);justify-content:center;overflow:hidden;background:#fff;box-shadow:0 14px 35px #1d35571a}.pimaco-label{box-sizing:border-box;width:66.7mm;height:25.4mm;padding:2.5mm 2.2mm;display:flex;align-items:center;gap:2.2mm;overflow:hidden;position:relative}.pimaco-label img{width:19mm;height:19mm;flex:none}.pimaco-label div{min-width:0;display:flex;flex-direction:column;gap:1mm;overflow:hidden}.pimaco-label strong{color:#2458d6;font-size:13pt;line-height:1;letter-spacing:.08em}.pimaco-label b,.pimaco-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pimaco-label b{font-size:7.5pt;line-height:1.1}.pimaco-label span{color:#64748b;font-size:6.5pt;line-height:1.1}.label-slot-picker{position:absolute;z-index:2;inset:1px 1px auto 1px;width:calc(100% - 2px);padding:3px;font-size:9px;opacity:.94}.empty-label-slot{color:#94a3b8;font-size:8pt}.label-sheet-note{max-width:900px;margin:15px auto 0;color:#64748b;font-size:12px}@media print{.label-sheet-page{padding:0;background:#fff}.label-sheet-toolbar,.label-sheet-controls,.label-sheet-note,.label-slot-picker,.empty-label-slot{display:none}.label-sheet{margin:0;box-shadow:none}.pimaco-label>img,.pimaco-label>div{transform:translateY(-2.5mm)}}`}</style></main>;
}
