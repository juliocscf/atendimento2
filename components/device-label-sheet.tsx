'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type LabelDevice = { id: string; code: string; kind: string; brand: string; model: string; serial: string | null };
type LabelAdjustment = { x: number; y: number; scale: number; rotation: number };
const emptyAdjustment = (): LabelAdjustment => ({ x: 0, y: 0, scale: 100, rotation: 0 });

export function DeviceLabelSheet({ devices }: { devices: LabelDevice[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [startPosition, setStartPosition] = useState(1);
  const [assignments, setAssignments] = useState<Array<string | null>>(() => Array.from({ length: 30 }, (_, index) => devices[index]?.id ?? null));
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [columnGap, setColumnGap] = useState(0);
  const [rowGap, setRowGap] = useState(0);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [individualMode, setIndividualMode] = useState(false);
  const [labelAdjustments, setLabelAdjustments] = useState<LabelAdjustment[]>(() => Array.from({ length: 30 }, emptyAdjustment));
  useEffect(() => {
    let active = true;
    void Promise.all(devices.map(async device => [device.id, await QRCode.toDataURL(`${window.location.origin}/equipamentos/${device.id}/etiqueta`, { width: 160, margin: 0, errorCorrectionLevel: 'M' })] as const)).then(entries => { if (active) setCodes(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [devices]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('nexo:pimaco-calibration-v2') ?? '{}') as {
          offsetX?: number;
          offsetY?: number;
          columnGap?: number;
          rowGap?: number;
          scale?: number;
          rotation?: number;
          labelAdjustments?: Array<Partial<LabelAdjustment>>;
        };
        if (typeof saved.offsetX === 'number') setOffsetX(saved.offsetX);
        if (typeof saved.offsetY === 'number') setOffsetY(saved.offsetY);
        if (typeof saved.columnGap === 'number') setColumnGap(saved.columnGap);
        if (typeof saved.rowGap === 'number') setRowGap(saved.rowGap);
        if (typeof saved.scale === 'number') setScale(saved.scale);
        if (typeof saved.rotation === 'number') setRotation(saved.rotation);
        if (Array.isArray(saved.labelAdjustments)) setLabelAdjustments(saved.labelAdjustments.slice(0, 30).map(item => ({ ...emptyAdjustment(), ...item })));
      } catch { /* use standard calibration when storage is unavailable */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
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
  function saveCalibration() {
    localStorage.setItem('nexo:pimaco-calibration-v2', JSON.stringify({ offsetX, offsetY, columnGap, rowGap, scale, rotation, labelAdjustments }));
  }
  function resetCalibration() {
    setOffsetX(0); setOffsetY(0); setColumnGap(0); setRowGap(0); setScale(100); setRotation(0);
    localStorage.removeItem('nexo:pimaco-calibration-v2');
    setLabelAdjustments(Array.from({ length: 30 }, emptyAdjustment));
  }
  function updateLabelAdjustment(index: number, change: Partial<LabelAdjustment>) { setLabelAdjustments(current => current.map((item, position) => position === index ? { ...item, ...change } : item)); }
  const filledCount = assignedDevices.filter(Boolean).length;
  const calibrationStyle = { '--sheet-offset-x': `${offsetX}mm`, '--sheet-offset-y': `${offsetY}mm`, '--sheet-column-gap': `${columnGap}mm`, '--sheet-row-gap': `${rowGap}mm`, '--label-scale': scale / 100, '--label-rotation': `${rotation}deg` } as CSSProperties;
  return <main className="label-sheet-page"><div className="label-sheet-toolbar"><Link href="/equipamentos">← Voltar para equipamentos</Link><div><span>{filledCount} de 30 posições preenchidas</span><button type="button" onClick={() => window.print()}>Imprimir folha</button></div></div><section className="label-sheet-controls" aria-label="Escolha das posições"><div><b>Organize a folha</b><p>Escolha o equipamento em cada posição ou preencha automaticamente a partir de uma posição.</p></div><div className="label-sheet-actions"><label>Começar na posição<select value={startPosition} onChange={event => setStartPosition(Number(event.target.value))}>{Array.from({ length: 30 }, (_, index) => <option value={index + 1} key={index}>Posição {index + 1}</option>)}</select></label><button type="button" className="button secondary" onClick={fillFromStart}>Preencher automaticamente</button><button type="button" className="button secondary" onClick={clearSheet}>Limpar folha</button></div></section><section className="label-calibration" aria-label="Ajuste fino da impressão"><div><b>Ajuste fino da impressora</b><p>Use valores pequenos, como 0,5 mm, e teste em papel comum.</p></div><div className="calibration-fields"><label>Horizontal (mm)<input type="number" step="0.5" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label><label>Vertical (mm)<input type="number" step="0.5" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label><label>Colunas (mm)<input type="number" step="0.5" value={columnGap} onChange={event => setColumnGap(Number(event.target.value))} /></label><label>Linhas (mm)<input type="number" step="0.5" value={rowGap} onChange={event => setRowGap(Number(event.target.value))} /></label><label>Escala (%)<input type="number" min="90" max="110" step="0.5" value={scale} onChange={event => setScale(Number(event.target.value))} /></label><label>Rotação<select value={rotation} onChange={event => setRotation(Number(event.target.value))}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><button type="button" className="button secondary" onClick={() => setIndividualMode(mode => !mode)}>{individualMode ? 'Fechar ajustes individuais' : 'Ajustar etiquetas individualmente'}</button><button type="button" className="button secondary" onClick={saveCalibration}>Salvar ajuste</button><button type="button" className="button secondary" onClick={resetCalibration}>Restaurar padrão</button></div></section><section className="label-sheet" style={calibrationStyle} aria-label="Folha de etiquetas Pimaco 6280">{assignedDevices.map((device, index) => { const adjustment = labelAdjustments[index]; const labelStyle = { '--label-x': `${adjustment.x}mm`, '--label-y': `${adjustment.y}mm`, '--label-scale-individual': adjustment.scale / 100, '--label-rotation-individual': `${adjustment.rotation}deg` } as CSSProperties; return <div className="pimaco-label" style={labelStyle} key={`slot-${index}`}><select className="label-slot-picker" aria-label={`Equipamento da posição ${index + 1}`} value={device?.id ?? ''} onChange={event => assign(index, event.target.value)}><option value="">Posição {index + 1} · vazia</option>{devices.map(option => <option value={option.id} key={option.id}>{option.code} · {option.brand} {option.model}</option>)}</select>{device ? <><img src={codes[device.id] ?? ''} alt="" aria-hidden="true" /><div><strong>{device.code}</strong><b>{device.brand} {device.model}</b><span>{device.kind}{device.serial ? ` · ${device.serial}` : ''}</span></div></> : <span className="empty-label-slot">Posição {index + 1}</span>}{individualMode && <div className="label-adjustment"><b>Posição {index + 1}</b><label>X<input type="number" step="0.5" value={adjustment.x} onChange={event => updateLabelAdjustment(index, { x: Number(event.target.value) })} /></label><label>Y<input type="number" step="0.5" value={adjustment.y} onChange={event => updateLabelAdjustment(index, { y: Number(event.target.value) })} /></label><label>%<input type="number" min="90" max="110" step="0.5" value={adjustment.scale} onChange={event => updateLabelAdjustment(index, { scale: Number(event.target.value) })} /></label><label>°<input type="number" step="90" value={adjustment.rotation} onChange={event => updateLabelAdjustment(index, { rotation: Number(event.target.value) })} /></label></div>}</div>; })}</section><p className="label-sheet-note">Imprima em escala 100%, sem “ajustar à página”. Faça um teste em papel comum antes da folha adesiva.</p><style jsx>{`@page{size:A4;margin:0}.label-sheet-page{min-height:100vh;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;padding:28px}.label-sheet-toolbar{max-width:900px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center;gap:18px}.label-sheet-toolbar a{color:#2458d6;text-decoration:none;font-size:14px}.label-sheet-toolbar div{display:flex;align-items:center;gap:12px}.label-sheet-toolbar span{color:#64748b;font-size:12px}.label-sheet-toolbar button{border:0;border-radius:10px;background:#2458d6;color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.label-sheet-controls,.label-calibration{max-width:900px;margin:0 auto 18px;padding:15px 17px;background:#fff;border:1px solid #dbe2ee;border-radius:12px;display:flex;justify-content:space-between;gap:18px;align-items:center}.label-sheet-controls b,.label-calibration b{font-size:13px}.label-sheet-controls p,.label-calibration p{margin:4px 0 0;color:#64748b;font-size:11px}.label-sheet-actions,.calibration-fields{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}.label-sheet-actions label,.calibration-fields label{display:flex;flex-direction:column;gap:5px;color:#64748b;font-size:10px;font-weight:700}.label-sheet-actions select,.label-slot-picker,.calibration-fields input,.calibration-fields select{border:1px solid #dbe2ee;border-radius:7px;background:#fff;color:#41506a;padding:8px}.label-sheet{box-sizing:border-box;width:210mm;height:297mm;margin:0 auto;padding:21.5mm 4.95mm;display:grid;grid-template-columns:repeat(3,66.7mm);grid-template-rows:repeat(10,25.4mm);column-gap:var(--sheet-column-gap);row-gap:var(--sheet-row-gap);justify-content:start;align-content:start;overflow:hidden;background:#fff;box-shadow:0 14px 35px #1d35571a;transform:translate(var(--sheet-offset-x),var(--sheet-offset-y))}.pimaco-label{box-sizing:border-box;width:66.7mm;height:25.4mm;padding:2.5mm 2.2mm;display:flex;align-items:center;gap:2.2mm;overflow:hidden;position:relative}.pimaco-label img{width:19mm;height:19mm;flex:none}.pimaco-label div{min-width:0;display:flex;flex-direction:column;gap:1mm;overflow:hidden}.pimaco-label strong{color:#2458d6;font-size:13pt;line-height:1;letter-spacing:.08em}.pimaco-label b,.pimaco-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pimaco-label b{font-size:7.5pt;line-height:1.1}.pimaco-label span{color:#64748b;font-size:6.5pt;line-height:1.1}.label-slot-picker{position:absolute;z-index:2;inset:1px 1px auto 1px;width:calc(100% - 2px);padding:3px;font-size:9px;opacity:.94}.empty-label-slot{color:#94a3b8;font-size:8pt}.label-adjustment{position:absolute;z-index:4;inset:3px;padding:5px;background:#fff;border:1px solid #cfd8ea;border-radius:6px;box-shadow:0 8px 20px #1d355725;display:grid;grid-template-columns:repeat(4,1fr);gap:3px}.label-adjustment b{grid-column:1/-1;font-size:9px}.label-adjustment label{font-size:8px;color:#64748b}.label-adjustment input{width:100%;box-sizing:border-box;padding:2px;border:1px solid #dbe2ee;border-radius:3px;font-size:9px}.label-sheet-note{max-width:900px;margin:15px auto 0;color:#64748b;font-size:12px}@media print{.label-sheet-page{padding:0;background:#fff}.label-sheet-toolbar,.label-sheet-controls,.label-calibration,.label-sheet-note,.label-slot-picker,.label-adjustment,.empty-label-slot{display:none}.label-sheet{margin:0;box-shadow:none}.pimaco-label>img,.pimaco-label>div{transform:translate(var(--label-x),var(--label-y)) scale(calc(var(--label-scale) * var(--label-scale-individual))) rotate(var(--label-rotation)) rotate(var(--label-rotation-individual))}}`}</style></main>;
}

