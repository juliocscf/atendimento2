'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, LoaderCircle, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { formatBrazilianDocument, documentError, isValidBrazilianDocument, onlyDigits, type BrazilianDocumentType } from '@/lib/brazil-documents';
import { type Client, type Device, newCode } from '@/lib/demo';

type DraftDevice = { id: string; kind: string; brand: string; model: string; serial: string; notes: string };
const emptyDevice = (): DraftDevice => ({ id: crypto.randomUUID(), kind: 'Notebook', brand: '', model: '', serial: '', notes: '' });

type Notify = (message: string, error?: boolean) => void;
type CustomerForm = {
  fullName: string;
  legalName: string;
  tradeName: string;
  phone: string;
  email: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
};

const initialForm: CustomerForm = { fullName: '', legalName: '', tradeName: '', phone: '', email: '', postalCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', notes: '' };

export function ClientRegistrationModal({ liveMode = false, client, onCreated, close, notify }: { liveMode?: boolean; client?: Client; onCreated?: () => void; close: () => void; notify: Notify }) {
  const { commit } = useDemo();
  const [documentType, setDocumentType] = useState<BrazilianDocumentType>(client?.documentType ?? 'cpf');
  const [taxId, setTaxId] = useState(client?.taxId ?? '');
  const [form, setForm] = useState<CustomerForm>({ ...initialForm, ...client?.addressFields, fullName: client?.name ?? '', phone: client?.phone ?? '', email: client?.email ?? '', legalName: client?.legalName ?? '', tradeName: client?.tradeName ?? '', notes: client?.notes ?? '' });
  const [busy, setBusy] = useState<'cnpj' | 'cep' | 'save' | null>(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [companyStatus, setCompanyStatus] = useState('');
  const [devices, setDevices] = useState<DraftDevice[]>([]);

  const lookupLock = useRef(false);
  const lookupVersion = useRef(0);
  useEffect(() => { function escape(event: KeyboardEvent) { if (event.key === 'Escape' && !busy) close(); } window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [close, busy]);

  function updateDevice(id: string, field: keyof Omit<DraftDevice, 'id'>, value: string) {
    setDevices(current => current.map(device => device.id === id ? { ...device, [field]: value } : device));
  }

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function lookupCnpj() {
    if (busy || lookupLock.current || documentType !== 'cnpj' || !isValidBrazilianDocument('cnpj', taxId)) return;
    lookupLock.current = true;
    const version = ++lookupVersion.current;
    setBusy('cnpj');
    setLookupMessage('Consultando dados públicos do CNPJ…');
    try {
      const response = await fetch(`/api/lookup/cnpj?document=${onlyDigits(taxId)}`);
      const payload = await response.json() as { data?: { legalName: string; tradeName: string; email: string; phone: string; postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; status: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'Não foi possível consultar o CNPJ.');
      if (version !== lookupVersion.current) return;
      const data = payload.data;
      setForm(current => ({ ...current, fullName: data.tradeName || data.legalName, legalName: data.legalName, tradeName: data.tradeName, email: current.email || data.email, phone: current.phone || data.phone, postalCode: data.postalCode, street: data.street, number: data.number, complement: data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state }));
      setCompanyStatus(data.status);
      setLookupMessage('Dados encontrados. Revise antes de salvar.');
    } catch (error) {
      setLookupMessage('');
      notify(error instanceof Error ? error.message : 'Não foi possível consultar o CNPJ.', true);
    } finally {
      lookupLock.current = false;
      setBusy(null);
    }
  }

  async function lookupCep() {
    if (busy || lookupLock.current || onlyDigits(form.postalCode).length !== 8) return;
    lookupLock.current = true;
    const version = ++lookupVersion.current;
    setBusy('cep');
    try {
      const response = await fetch(`/api/lookup/cep?postalCode=${onlyDigits(form.postalCode)}`);
      const payload = await response.json() as { data?: { street: string; complement: string; neighborhood: string; city: string; state: string; postalCode: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'Não foi possível consultar o CEP.');
      if (version !== lookupVersion.current) return;
      const data = payload.data;
      setForm(current => ({ ...current, postalCode: data.postalCode, street: data.street, complement: current.complement || data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state }));
      notify('Endereço preenchido pelo CEP. Revise o número e o complemento.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.', true);
    } finally {
      lookupLock.current = false;
      setBusy(null);
    }
  }

  function changeDocumentType(next: BrazilianDocumentType) {
    lookupVersion.current++;
    setDocumentType(next);
    setTaxId('');
    setCompanyStatus('');
    setLookupMessage('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const error = client && !taxId ? null : documentError(documentType, taxId);
    if (error) return notify(error, true);
    if (form.fullName.trim().length < 3 || form.phone.trim().length < 8) return notify('Informe nome e telefone válidos.', true);
    const invalidDevice = devices.findIndex(device => device.kind.trim().length < 2 || device.brand.trim().length < 2 || device.model.trim().length < 2);
    if (invalidDevice !== -1) return notify(`Equipamento ${invalidDevice + 1}: informe tipo, marca e modelo.`, true);
    setBusy('save');
    const address = { postalCode: form.postalCode, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood, city: form.city, state: form.state };
    if (liveMode) {
      try {
        const response = await fetch('/api/clients', { method: client ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: client?.id, fullName: form.fullName, phone: form.phone, email: form.email, taxId: onlyDigits(taxId), documentType, legalName: form.legalName, tradeName: form.tradeName, notes: form.notes, address, devices: devices.map(({ kind, brand, model, serial, notes }) => ({ kind: kind.trim(), brand: brand.trim(), model: model.trim(), serial: serial.trim(), notes: notes.trim() })) }) });
        const payload = await response.json() as { data?: { full_name: string; devices?: Array<{ code: string }> }; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Não foi possível cadastrar o cliente.');
        const savedDevices = payload.data?.devices ?? [];
        notify(`Cliente ${payload.data?.full_name ?? form.fullName} ${client ? 'atualizado' : 'cadastrado'}${savedDevices.length ? ` com ${savedDevices.length} ${savedDevices.length === 1 ? 'equipamento' : 'equipamentos'}` : ''}.`);
        onCreated?.();
        close();
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.', true);
      } finally {
        setBusy(null);
      }
      return;
    }
    const addressLabel = [form.street, form.number, form.neighborhood, form.city, form.state].filter(Boolean).join(', ');
    const savedClient: Client = { id: client?.id ?? `c-${Date.now()}`, name: form.fullName, phone: form.phone, email: form.email, address: addressLabel, taxId: onlyDigits(taxId), documentType, legalName: form.legalName, tradeName: form.tradeName, notes: form.notes, addressFields: address };
    const success = commit(current => {
      const createdDevices: Device[] = [];
      for (const item of devices) createdDevices.push({ id: item.id, clientId: savedClient.id, code: newCode([...current.devices, ...createdDevices]), kind: item.kind.trim(), brand: item.brand.trim(), model: item.model.trim(), serial: item.serial.trim(), notes: item.notes.trim() });
      return { ...current, clients: current.clients.some(item => item.id === savedClient.id) ? current.clients.map(item => item.id === savedClient.id ? savedClient : item) : [savedClient, ...current.clients], devices: [...createdDevices, ...current.devices] };
    }, `Cliente ${form.fullName} ${client ? 'atualizado' : 'cadastrado'}${devices.length ? ` com ${devices.length} ${devices.length === 1 ? 'equipamento' : 'equipamentos'}` : ''}.`);
    setBusy(null);
    if (success) close();
  }

  const currentDocumentError = taxId ? documentError(documentType, taxId) : null;
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal client-registration-modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title"><header><div><span className="eyebrow">Nexo · cadastro</span><h2 id="client-modal-title">{client ? 'Editar cliente' : 'Cadastrar cliente'}</h2><p>Valide o documento e aproveite os dados públicos para preencher o cadastro.</p></div><button className="icon-button" type="button" aria-label="Fechar janela" onClick={close}>×</button></header><div className="modal-body"><form onSubmit={submit}>
    <div className="client-type-picker" role="group" aria-label="Tipo de pessoa"><button type="button" className={documentType === 'cpf' ? 'selected' : ''} onClick={() => changeDocumentType('cpf')}>Pessoa física <small>CPF</small></button><button type="button" className={documentType === 'cnpj' ? 'selected' : ''} onClick={() => changeDocumentType('cnpj')}>Pessoa jurídica <small>CNPJ</small></button></div>
    <div className="form-grid"><label>{documentType === 'cpf' ? 'CPF' : 'CNPJ'}<div className="input-with-action"><input value={formatBrazilianDocument(documentType, taxId)} onChange={event => { lookupVersion.current++; setTaxId(onlyDigits(event.target.value)); }} onBlur={() => { if (!client && documentType === 'cnpj') void lookupCnpj(); }} placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} inputMode="numeric" required={!client} />{documentType === 'cnpj' && <button className="plain-icon" type="button" aria-label="Consultar CNPJ" title="Consultar CNPJ" onClick={() => void lookupCnpj()} disabled={busy === 'cnpj'}>{busy === 'cnpj' ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}</button>}</div>{currentDocumentError && <small className="field-error">{currentDocumentError}</small>}{companyStatus && <small className="field-success"><Check size={13} /> Situação cadastral: {companyStatus}</small>}</label><label>Nome para atendimento<input value={form.fullName} onChange={event => update('fullName', event.target.value)} placeholder={documentType === 'cnpj' ? 'Nome fantasia ou razão social' : 'Nome completo'} required /></label>{documentType === 'cnpj' && <><label>Razão social<input value={form.legalName} onChange={event => update('legalName', event.target.value)} placeholder="Preenchida pela consulta do CNPJ" /></label><label>Nome fantasia<input value={form.tradeName} onChange={event => update('tradeName', event.target.value)} placeholder="Preenchido pela consulta do CNPJ" /></label></>}<label>Telefone<input value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="(11) 90000-0000" required /></label><label>E-mail<input value={form.email} onChange={event => update('email', event.target.value)} type="email" placeholder="cliente@email.com" /></label></div>
    {lookupMessage && <div className="form-hint"><ShieldCheck size={16} /> {lookupMessage}</div>}
    <div className="address-heading"><div><span className="eyebrow">Endereço principal</span><h3>Onde o cliente pode ser encontrado</h3></div><span className="address-hint">CEP preenche os campos automaticamente</span></div>
    <div className="form-grid"><label>CEP<div className="input-with-action"><input value={form.postalCode} onChange={event => { lookupVersion.current++; update('postalCode', event.target.value.replace(/\D/g, '').slice(0, 8)); }} onBlur={() => void lookupCep()} placeholder="00000-000" inputMode="numeric" />{busy === 'cep' && <LoaderCircle className="spin" size={16} />}</div></label><label>Logradouro<input value={form.street} onChange={event => update('street', event.target.value)} placeholder="Rua, avenida…" /></label><label>Número<input value={form.number} onChange={event => update('number', event.target.value)} placeholder="Ex.: 240" /></label><label>Complemento<input value={form.complement} onChange={event => update('complement', event.target.value)} placeholder="Sala, bloco, referência" /></label><label>Bairro<input value={form.neighborhood} onChange={event => update('neighborhood', event.target.value)} /></label><label>Cidade<input value={form.city} onChange={event => update('city', event.target.value)} /></label><label>UF<input value={form.state} onChange={event => update('state', event.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} /></label></div>
    <div className="address-heading"><div><span className="eyebrow">Equipamentos · opcional</span><h3>{client ? 'Adicionar novos equipamentos' : 'Equipamentos do cliente'}</h3></div><span className="address-hint">{devices.length} de 10 adicionados</span></div>
    {devices.map((device, index) => <fieldset className="client-equipment-entry" key={device.id}><legend>Equipamento {index + 1}</legend><button className="button secondary client-equipment-remove" type="button" onClick={() => setDevices(current => current.filter(item => item.id !== device.id))} disabled={Boolean(busy)} aria-label={`Remover equipamento ${index + 1}`}><Trash2 size={14} /> Remover</button><div className="form-grid"><label>Tipo<select value={device.kind} onChange={event => updateDevice(device.id, 'kind', event.target.value)}><option>Notebook</option><option>Desktop</option><option>Celular</option><option>Impressora</option><option>Rede / outros</option></select></label><label>Marca<input value={device.brand} onChange={event => updateDevice(device.id, 'brand', event.target.value)} placeholder="Ex.: Dell" required minLength={2} /></label><label>Modelo<input value={device.model} onChange={event => updateDevice(device.id, 'model', event.target.value)} placeholder="Ex.: Inspiron 15" required minLength={2} /></label><label>Número de série<input value={device.serial} onChange={event => updateDevice(device.id, 'serial', event.target.value)} placeholder="Opcional" /></label></div><label className="full-label">Observações do equipamento<textarea value={device.notes} onChange={event => updateDevice(device.id, 'notes', event.target.value)} rows={2} placeholder="Acessórios recebidos, estado físico, detalhes importantes…" /></label></fieldset>)}
    <button className="button secondary client-add-equipment" type="button" onClick={() => setDevices(current => [...current, emptyDevice()])} disabled={Boolean(busy) || devices.length >= 10}><Plus size={16} /> Adicionar equipamento</button>
    <label className="full-label">Observações<textarea value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Preferências de contato, referência ou observações do cadastro." rows={3} /></label>
    <div className="form-hint"><ShieldCheck size={16} /> Os dados retornados por consulta são sugestões. Confirme tudo antes de cadastrar.</div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={Boolean(busy) || Boolean(currentDocumentError)}>{busy === 'save' ? 'Salvando…' : <>{client ? 'Salvar alterações' : 'Cadastrar cliente'} <ChevronRight size={16} /></>}</button></div>
  </form></div></section></div>;
}
