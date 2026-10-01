'use client';

import { useState } from 'react';
import { Check, ChevronRight, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { formatBrazilianDocument, documentError, isValidBrazilianDocument, onlyDigits, type BrazilianDocumentType } from '@/lib/brazil-documents';
import { type Client } from '@/lib/demo';

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

export function ClientRegistrationModal({ liveMode = false, onCreated, close, notify }: { liveMode?: boolean; onCreated?: () => void; close: () => void; notify: Notify }) {
  const { commit } = useDemo();
  const [documentType, setDocumentType] = useState<BrazilianDocumentType>('cpf');
  const [taxId, setTaxId] = useState('');
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [busy, setBusy] = useState<'cnpj' | 'cep' | 'save' | null>(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [companyStatus, setCompanyStatus] = useState('');

  function update<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function lookupCnpj() {
    if (documentType !== 'cnpj' || !isValidBrazilianDocument('cnpj', taxId)) return;
    setBusy('cnpj');
    setLookupMessage('Consultando dados públicos do CNPJ…');
    try {
      const response = await fetch(`/api/lookup/cnpj?document=${onlyDigits(taxId)}`);
      const payload = await response.json() as { data?: { legalName: string; tradeName: string; email: string; phone: string; postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; status: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'Não foi possível consultar o CNPJ.');
      const data = payload.data;
      setForm(current => ({ ...current, fullName: data.tradeName || data.legalName, legalName: data.legalName, tradeName: data.tradeName, email: current.email || data.email, phone: current.phone || data.phone, postalCode: data.postalCode, street: data.street, number: data.number, complement: data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state }));
      setCompanyStatus(data.status);
      setLookupMessage('Dados encontrados. Revise antes de salvar.');
    } catch (error) {
      setLookupMessage('');
      notify(error instanceof Error ? error.message : 'Não foi possível consultar o CNPJ.', true);
    } finally {
      setBusy(null);
    }
  }

  async function lookupCep() {
    if (onlyDigits(form.postalCode).length !== 8) return;
    setBusy('cep');
    try {
      const response = await fetch(`/api/lookup/cep?postalCode=${onlyDigits(form.postalCode)}`);
      const payload = await response.json() as { data?: { street: string; complement: string; neighborhood: string; city: string; state: string; postalCode: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'Não foi possível consultar o CEP.');
      const data = payload.data;
      setForm(current => ({ ...current, postalCode: data.postalCode, street: data.street, complement: current.complement || data.complement, neighborhood: data.neighborhood, city: data.city, state: data.state }));
      notify('Endereço preenchido pelo CEP. Revise o número e o complemento.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível consultar o CEP.', true);
    } finally {
      setBusy(null);
    }
  }

  function changeDocumentType(next: BrazilianDocumentType) {
    setDocumentType(next);
    setTaxId('');
    setCompanyStatus('');
    setLookupMessage('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = documentError(documentType, taxId);
    if (error) return notify(error, true);
    if (form.fullName.trim().length < 3 || form.phone.trim().length < 8) return notify('Informe nome e telefone válidos.', true);
    setBusy('save');
    const address = { postalCode: form.postalCode, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood, city: form.city, state: form.state };
    if (liveMode) {
      try {
        const response = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: form.fullName, phone: form.phone, email: form.email, taxId: onlyDigits(taxId), documentType, legalName: form.legalName, tradeName: form.tradeName, notes: form.notes, address }) });
        const payload = await response.json() as { data?: { full_name: string }; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Não foi possível cadastrar o cliente.');
        notify(`Cliente ${payload.data?.full_name ?? form.fullName} cadastrado.`);
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
    const client: Client = { id: `c-${Date.now()}`, name: form.fullName, phone: form.phone, email: form.email, address: addressLabel, taxId: onlyDigits(taxId), documentType, legalName: form.legalName, tradeName: form.tradeName };
    const success = commit(current => ({ ...current, clients: [client, ...current.clients] }), `Cliente ${form.fullName} cadastrado.`);
    setBusy(null);
    if (success) close();
  }

  const currentDocumentError = taxId ? documentError(documentType, taxId) : null;
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal client-registration-modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title"><header><div><span className="eyebrow">Nexo · cadastro</span><h2 id="client-modal-title">Cadastrar cliente</h2><p>Valide o documento e aproveite os dados públicos para preencher o cadastro.</p></div><button className="icon-button" type="button" aria-label="Fechar janela" onClick={close}>×</button></header><div className="modal-body"><form onSubmit={submit}>
    <div className="client-type-picker" role="group" aria-label="Tipo de pessoa"><button type="button" className={documentType === 'cpf' ? 'selected' : ''} onClick={() => changeDocumentType('cpf')}>Pessoa física <small>CPF</small></button><button type="button" className={documentType === 'cnpj' ? 'selected' : ''} onClick={() => changeDocumentType('cnpj')}>Pessoa jurídica <small>CNPJ</small></button></div>
    <div className="form-grid"><label>{documentType === 'cpf' ? 'CPF' : 'CNPJ'}<div className="input-with-action"><input value={formatBrazilianDocument(documentType, taxId)} onChange={event => setTaxId(onlyDigits(event.target.value))} onBlur={() => { if (documentType === 'cnpj') void lookupCnpj(); }} placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} inputMode="numeric" required />{documentType === 'cnpj' && <button className="plain-icon" type="button" aria-label="Consultar CNPJ" title="Consultar CNPJ" onClick={() => void lookupCnpj()} disabled={busy === 'cnpj'}>{busy === 'cnpj' ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}</button>}</div>{currentDocumentError && <small className="field-error">{currentDocumentError}</small>}{companyStatus && <small className="field-success"><Check size={13} /> Situação cadastral: {companyStatus}</small>}</label><label>Nome para atendimento<input value={form.fullName} onChange={event => update('fullName', event.target.value)} placeholder={documentType === 'cnpj' ? 'Nome fantasia ou razão social' : 'Nome completo'} required /></label>{documentType === 'cnpj' && <><label>Razão social<input value={form.legalName} onChange={event => update('legalName', event.target.value)} placeholder="Preenchida pela consulta do CNPJ" /></label><label>Nome fantasia<input value={form.tradeName} onChange={event => update('tradeName', event.target.value)} placeholder="Preenchido pela consulta do CNPJ" /></label></>}<label>Telefone<input value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="(11) 90000-0000" required /></label><label>E-mail<input value={form.email} onChange={event => update('email', event.target.value)} type="email" placeholder="cliente@email.com" /></label></div>
    {lookupMessage && <div className="form-hint"><ShieldCheck size={16} /> {lookupMessage}</div>}
    <div className="address-heading"><div><span className="eyebrow">Endereço principal</span><h3>Onde o cliente pode ser encontrado</h3></div><span className="address-hint">CEP preenche os campos automaticamente</span></div>
    <div className="form-grid"><label>CEP<div className="input-with-action"><input value={form.postalCode} onChange={event => update('postalCode', event.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={() => void lookupCep()} placeholder="00000-000" inputMode="numeric" />{busy === 'cep' && <LoaderCircle className="spin" size={16} />}</div></label><label>Logradouro<input value={form.street} onChange={event => update('street', event.target.value)} placeholder="Rua, avenida…" /></label><label>Número<input value={form.number} onChange={event => update('number', event.target.value)} placeholder="Ex.: 240" /></label><label>Complemento<input value={form.complement} onChange={event => update('complement', event.target.value)} placeholder="Sala, bloco, referência" /></label><label>Bairro<input value={form.neighborhood} onChange={event => update('neighborhood', event.target.value)} /></label><label>Cidade<input value={form.city} onChange={event => update('city', event.target.value)} /></label><label>UF<input value={form.state} onChange={event => update('state', event.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} /></label></div>
    <label className="full-label">Observações<textarea value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Preferências de contato, referência ou observações do cadastro." rows={3} /></label>
    <div className="form-hint"><ShieldCheck size={16} /> Os dados retornados por consulta são sugestões. Confirme tudo antes de cadastrar.</div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy === 'save' || Boolean(currentDocumentError)}>{busy === 'save' ? 'Salvando…' : <>Cadastrar cliente <ChevronRight size={16} /></>}</button></div>
  </form></div></section></div>;
}
