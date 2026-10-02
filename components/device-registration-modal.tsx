'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Camera, ChevronRight, X } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { type DemoData, newCode } from '@/lib/demo';

type Props = {
  data: DemoData;
  liveMode: boolean;
  onCreated?: () => void;
  close: () => void;
  notify: (message: string, error?: boolean) => void;
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPhotoSize = 10 * 1024 * 1024;

export function DeviceRegistrationModal({ data, liveMode, onCreated, close, notify }: Props) {
  const { commit } = useDemo();
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [savedDevice, setSavedDevice] = useState<{ id: string; code: string } | null>(null);
  const [photoError, setPhotoError] = useState('');

  function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.some(file => !allowedTypes.has(file.type) || file.size > maxPhotoSize)) {
      notify('Escolha fotos JPEG, PNG ou WebP de até 10 MB cada.', true);
      return;
    }
    if (photos.length + selected.length > 10) {
      notify('Selecione no máximo 10 fotos por cadastro.', true);
      return;
    }
    setPhotos(current => [...current, ...selected]);
    setPhotoError('');
  }

  async function uploadPhotos(device: { id: string; code: string }) {
    const pending: File[] = [];
    for (const file of photos) {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`/api/devices/${device.id}/photos`, { method: 'POST', body });
        if (!response.ok) pending.push(file);
      } catch {
        pending.push(file);
      }
    }
    setPhotos(pending);
    if (pending.length) {
      setPhotoError(`${pending.length} ${pending.length === 1 ? 'foto não foi enviada' : 'fotos não foram enviadas'}. Tente novamente ou abra Fotos no equipamento depois.`);
      notify(`Equipamento ${device.code} cadastrado; há fotos pendentes.`, true);
      return;
    }
    notify(`Equipamento ${device.code} cadastrado${photos.length ? ' com fotos' : ''}.`);
    close();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (savedDevice) {
        await uploadPhotos(savedDevice);
        return;
      }
      const form = new FormData(event.currentTarget);
      const clientId = String(form.get('clientId') ?? '');
      const kind = String(form.get('kind') ?? 'Notebook').trim();
      const brand = String(form.get('brand') ?? '').trim();
      const model = String(form.get('model') ?? '').trim();
      const serial = String(form.get('serial') ?? '').trim();
      if (!clientId || kind.length < 2 || brand.length < 2 || model.length < 2) {
        notify('Informe cliente, tipo, marca e modelo.', true);
        return;
      }
      if (liveMode) {
        const response = await fetch('/api/devices', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, kind, brand, model, serial }),
        });
        const result = await response.json() as { data?: { id: string; code: string }; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error ?? 'Não foi possível cadastrar o equipamento.');
        setSavedDevice(result.data);
        onCreated?.();
        await uploadPhotos(result.data);
        return;
      }
      if (photos.length) {
        notify('O envio de fotos está disponível apenas quando os dados estiverem conectados.', true);
        return;
      }
      const code = newCode(data.devices);
      const success = commit(current => ({ ...current, devices: [{ id: `d-${Date.now()}`, clientId, code, brand, model, serial, kind, notes: 'Cadastro criado na demonstração.' }, ...current.devices] }), `Equipamento ${code} cadastrado.`);
      if (success) close();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.', true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="device-modal-title">
      <header><div><span className="eyebrow">Nexo · equipamentos</span><h2 id="device-modal-title">{savedDevice ? `Equipamento ${savedDevice.code} cadastrado` : 'Cadastrar equipamento'}</h2><p>Registre os dados e as fotos do equipamento no mesmo cadastro.</p></div><button className="icon-button" type="button" aria-label="Fechar janela" onClick={close} disabled={busy}><X size={20} /></button></header>
      <div className="modal-body"><form onSubmit={submit}>
        {!savedDevice && <><div className="form-grid"><label>Cliente<select name="clientId" required><option value="">Selecione</option>{data.clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>Tipo<select name="kind" defaultValue="Notebook"><option>Notebook</option><option>Desktop</option><option>Celular</option><option>Impressora</option><option>Rede / outros</option></select></label><label>Marca<input name="brand" required minLength={2} placeholder="Ex.: Dell" /></label><label>Modelo<input name="model" required minLength={2} placeholder="Ex.: Inspiron 15" /></label><label>Número de série<input name="serial" placeholder="Opcional" /></label></div><div className="code-preview"><span>Próximo código</span><b>Gerado ao salvar</b><small>Alfabeto seguro · 4 caracteres</small></div></>}
        <div className="device-photo-input"><div><Camera size={18} /><span><b>Fotos do equipamento</b><small>{liveMode ? 'Opcional · JPEG, PNG ou WebP · até 10 MB por foto' : 'Fotos disponíveis quando os dados estiverem conectados'}</small></span></div><label>Selecionar fotos<input type="file" aria-label="Selecionar fotos do equipamento" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} disabled={busy} /></label>{photos.length > 0 && <ul>{photos.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}><span>{file.name}</span><button type="button" aria-label={`Remover foto ${file.name}`} onClick={() => setPhotos(current => current.filter((_, position) => position !== index))} disabled={busy}><X size={14} /></button></li>)}</ul>}{photoError && <p role="alert">{photoError}</p>}</div>
        {savedDevice && <p className="device-photo-note">O equipamento já está cadastrado. As fotos restantes podem ser enviadas aqui ou pela opção Fotos na lista.</p>}
        <div className="modal-footer">{savedDevice && <Link className="button secondary" href={`/equipamentos/${savedDevice.id}/etiqueta#fotos`}>Abrir Fotos</Link>}<button type="button" className="button secondary" onClick={close} disabled={busy}>{savedDevice ? 'Concluir' : 'Cancelar'}</button>{(!savedDevice || photos.length > 0) && <button className="button primary" disabled={busy}>{busy ? 'Enviando…' : savedDevice ? 'Tentar enviar fotos novamente' : <>Cadastrar equipamento <ChevronRight size={16} /></>}</button>}</div>
      </form></div>
    </section>
  </div>;
}
