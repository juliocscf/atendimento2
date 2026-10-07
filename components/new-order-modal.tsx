'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronRight, Headphones, House, ScanLine, ShieldCheck, Store, X } from 'lucide-react';
import { type Mode, type DemoData, hasConflict, nowLabel } from '@/lib/demo';
import { useDemo } from '@/components/demo-provider';

type Props = {
  data: DemoData;
  initialClientId?: string;
  initialDeviceId?: string;
  liveMode?: boolean;
  onCreated?: () => void;
  close: () => void;
  notify: (message: string, error?: boolean) => void;
};

const modeIcons = { Balcão: Store, Remoto: Headphones, Domicílio: House };
const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240];
const todayInBrazil = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
declare global { interface Window { BarcodeDetector?: BarcodeDetectorConstructor } }

function EquipmentQrScanner({ devices, onFound, close }: { devices: DemoData['devices']; onFound: (device: DemoData['devices'][number]) => void; close: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let active = true;
    async function start() {
      if (!window.BarcodeDetector) { setError('Seu navegador não oferece leitura de QR Code pela câmera. Informe o código abaixo.'); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setError('A câmera não está disponível neste dispositivo. Informe o código abaixo.'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const scan = async () => {
          if (!active || !videoRef.current) return;
          try {
            const result = await detector.detect(videoRef.current);
            const value = result[0]?.rawValue?.trim();
            if (value) {
              const code = value.match(/(?:^|[/?#=])([A-Z][A-Z0-9-]{2,20})(?:$|[/?#&])/i)?.[1] ?? value;
              const found = devices.find(device => device.code.toLowerCase() === code.toLowerCase());
              if (found) { onFound(found); return; }
              setError(`Nenhum equipamento com o código ${code} foi encontrado nesta unidade.`);
            }
          } catch { /* a câmera pode estar entre dois frames */ }
          frameRef.current = requestAnimationFrame(() => { void scan(); });
        };
        void scan();
      } catch { setError('Não foi possível acessar a câmera. Verifique a permissão ou informe o código manualmente.'); }
    }
    void start();
    return () => { active = false; stop(); };
  }, [devices, onFound]);

  function findManual() {
    const found = devices.find(device => device.code.toLowerCase() === manualCode.trim().toLowerCase());
    if (found) onFound(found);
    else setError('Código não encontrado. Confira a etiqueta e tente novamente.');
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal qr-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title"><header><div><span className="eyebrow">Nexo · equipamento</span><h2 id="qr-scanner-title">Ler QR Code</h2><p>Aponte a câmera para a etiqueta do equipamento.</p></div><button type="button" className="icon-button" aria-label="Fechar leitor" onClick={close}><X size={20} /></button></header><div className="modal-body"><div className="qr-camera-frame"><video ref={videoRef} muted playsInline aria-label="Câmera para leitura do QR Code" /><span className="qr-camera-guide" /></div>{error && <div className="auth-feedback error" role="alert">{error}</div>}<div className="qr-manual-entry"><label>Código visível na etiqueta<input value={manualCode} onChange={event => setManualCode(event.target.value.toUpperCase())} placeholder="Ex.: DLPQ" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); findManual(); } }} /></label><button type="button" className="button secondary" onClick={findManual} disabled={!manualCode.trim()}>Usar código</button></div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button></div></div></section></div>;
}

export function NewOrderModal({ data, initialClientId = '', initialDeviceId = '', liveMode = false, onCreated, close, notify }: Props) {
  const { commit } = useDemo();
  const [mode, setMode] = useState<Mode>('Balcão');
  const [clientId, setClientId] = useState(initialClientId || data.clients[0]?.id || '');
  const [deviceId, setDeviceId] = useState(initialDeviceId || (data.devices.find(device => device.clientId === (initialClientId || data.clients[0]?.id))?.id ?? ''));
  const [issue, setIssue] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [date, setDate] = useState(todayInBrazil);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const filteredDevices = data.devices.filter(device => device.clientId === clientId);

  const selectScannedDevice = useCallback((device: DemoData['devices'][number]) => {
    setClientId(device.clientId);
    setDeviceId(device.id);
    setScannerOpen(false);
    notify(`Equipamento ${device.code} identificado. Confira os dados e descreva o novo defeito.`);
  }, [notify]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId || issue.trim().length < 8) return notify('Informe o cliente e descreva o problema em pelo menos 8 caracteres.', true);
    const startAt = new Date(`${date}T${time}:00-03:00`);
    if (scheduled && (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now() || !durationOptions.includes(duration))) {
      return notify('Escolha uma data futura, horário e duração válidos.', true);
    }
    if (scheduled && mode === 'Domicílio' && !address.trim()) return notify('Informe o endereço da visita.', true);

    setSaving(true);
    try {
      if (liveMode) {
        const response = await fetch('/api/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, deviceId, mode, priority: 'Normal', issue: issue.trim(),
            dueDate: scheduled ? date : todayInBrazil(),
            ...(scheduled ? { schedule: { startAt: startAt.toISOString(), durationMinutes: duration, address: address.trim() } } : {}) }),
        });
        const result = await response.json() as { data?: { id: string; number: string; trackingUrl?: string; receiptUrl?: string }; error?: string };
        if (!response.ok) return notify(result.error ?? 'Não foi possível abrir a OS.', true);
        if (result.data?.id && result.data.trackingUrl) localStorage.setItem(`nexo:tracking:${result.data.id}`, result.data.trackingUrl);
        notify(`${result.data?.number ?? 'OS'} criada${scheduled ? ' e agendada' : ''} com sucesso.`);
        onCreated?.();
        close();
        if (result.data?.receiptUrl) window.open(result.data.receiptUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const orderId = `o-${crypto.randomUUID()}`;
      const nextNumber = `OS-${new Date().getFullYear()}-${1250 + data.orders.length}`;
      const candidate = { id: `a-${crypto.randomUUID()}`, orderId, date, time, duration,
        technician: 'Rafael Costa', title: mode === 'Remoto' ? 'Atendimento remoto' : mode === 'Domicílio' ? 'Visita ao cliente' : 'Atendimento no balcão',
        mode, address: mode === 'Domicílio' ? address.trim() : 'Matriz · Centro' };
      if (scheduled && hasConflict(data.appointments, candidate)) return notify('Este horário já está ocupado na agenda de Rafael Costa.', true);
      const success = commit(current => ({ ...current,
        orders: [{ id: orderId, createdAt: new Date().toISOString(), number: nextNumber, clientId, deviceId,
          mode, status: 'Recebido', priority: 'Normal', technician: 'Rafael Costa', issue: issue.trim(),
          due: scheduled ? date : todayInBrazil(), amount: 0, paid: 0, accessories: '',
          history: [{ text: 'Atendimento aberto na unidade Matriz · Centro.', at: nowLabel() }], contacts: [] }, ...current.orders],
        appointments: scheduled ? [...current.appointments, candidate] : current.appointments,
      }), `${nextNumber} criada${scheduled ? ' e agendada' : ''} com sucesso.`);
      if (success) close();
    } catch { notify('Não foi possível conectar ao servidor.', true); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
      <header><div><span className="eyebrow">Nexo · atendimento</span><h2 id="new-order-title">Abrir novo atendimento</h2>
        <p>Comece com os dados essenciais e, se quiser, reserve um horário.</p></div>
        <button type="button" className="icon-button" aria-label="Fechar janela" onClick={close}><X size={20} /></button></header>
      <div className="modal-body"><form onSubmit={submit}>
        <div className="modal-step"><span className="step-number">1</span><div><b>Como será o atendimento?</b><small>Escolha a modalidade para orientar os próximos passos.</small></div></div>
        <div className="mode-picker">{(['Balcão', 'Remoto', 'Domicílio'] as Mode[]).map(option => {
          const Icon = modeIcons[option];
          return <button type="button" className={mode === option ? 'selected' : ''} onClick={() => setMode(option)} key={option}>
            <Icon size={19} /><b>{option}</b><small>{option === 'Balcão' ? 'Na unidade' : option === 'Remoto' ? 'Sessão online' : 'No endereço'}</small>
          </button>;
        })}</div>
        <div className="form-grid"><label>Cliente<select value={clientId} onChange={event => { setClientId(event.target.value); setDeviceId(data.devices.find(device => device.clientId === event.target.value)?.id ?? ''); }} required>
          <option value="">Selecione</option>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select></label><label>Equipamento<select value={deviceId} onChange={event => setDeviceId(event.target.value)}>
          <option value="">Sem equipamento vinculado</option>{filteredDevices.map(device => <option key={device.id} value={device.id}>{device.code} · {device.brand} {device.model}</option>)}
        </select></label></div><button type="button" className="button secondary scan-equipment-button" onClick={() => setScannerOpen(true)}><ScanLine size={15} /> Ler QR Code do equipamento</button>
        <label className="full-label">Defeito relatado<textarea value={issue} onChange={event => setIssue(event.target.value)} placeholder="Ex.: notebook não liga desde ontem e faz um ruído ao conectar o carregador." rows={4} required minLength={8} /></label>
        <label className="schedule-toggle"><input type="checkbox" checked={scheduled} onChange={event => setScheduled(event.target.checked)} /><CalendarDays size={17} /> Agendar atendimento agora</label>
        {scheduled && <div className="schedule-fields"><p>O horário ficará reservado na sua agenda. Você poderá alterá-lo depois.</p>
          <div className="form-grid"><label>Data<input type="date" min={todayInBrazil()} value={date} onChange={event => setDate(event.target.value)} required /></label>
            <label>Horário<input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label>
            <label>Duração<select value={duration} onChange={event => setDuration(Number(event.target.value))}>{durationOptions.map(minutes => <option value={minutes} key={minutes}>{minutes} minutos</option>)}</select></label>
            {mode === 'Domicílio' && <label>Endereço da visita<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número e bairro" required /></label>}
          </div></div>}
        <div className="form-hint"><ShieldCheck size={16} /> O histórico será vinculado ao cliente e ao equipamento automaticamente.</div>
        <div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button>
          <button className="button primary" disabled={saving}>{saving ? 'Salvando…' : <>{scheduled ? 'Criar e agendar' : 'Criar atendimento'} <ChevronRight size={16} /></>}</button></div>
      </form></div>
    </section>{scannerOpen && <EquipmentQrScanner devices={data.devices} onFound={selectScannedDevice} close={() => setScannerOpen(false)} />}
  </div>;
}
