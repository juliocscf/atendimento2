'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { documentError, formatBrazilianDocument, onlyDigits, type BrazilianDocumentType } from '@/lib/brazil-documents';

type ProfileData = {
  fullName: string;
  phone: string;
  email: string;
  taxId: string;
  documentType: BrazilianDocumentType;
  legalName: string;
  tradeName: string;
  notes: string;
  address: { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string };
};

type InitialData = {
  purpose: 'register' | 'update';
  organization_name: string;
  expires_at: string;
  client?: Partial<ProfileData> | null;
  address?: Partial<ProfileData['address']> | null;
};

const emptyAddress = { postalCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

export function ClientProfileLinkForm({ token, initialData }: { token: string; initialData: InitialData }) {
  const client = initialData.client ?? {};
  const [documentType, setDocumentType] = useState<BrazilianDocumentType>(client.documentType ?? 'cpf');
  const [form, setForm] = useState<ProfileData>({
    fullName: client.fullName ?? '', phone: client.phone ?? '', email: client.email ?? '', taxId: client.taxId ?? '',
    documentType: client.documentType ?? 'cpf', legalName: client.legalName ?? '', tradeName: client.tradeName ?? '', notes: client.notes ?? '',
    address: { ...emptyAddress, ...(initialData.address ?? {}) },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function update(key: keyof Omit<ProfileData, 'address'>, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateAddress(key: keyof ProfileData['address'], value: string) {
    setForm(current => ({ ...current, address: { ...current.address, [key]: value } }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const docError = form.taxId || initialData.purpose === 'register' ? documentError(documentType, form.taxId) : null;
    if (docError) return setError(docError);
    if (form.fullName.trim().length < 3 || onlyDigits(form.phone).length < 8) return setError('Informe nome e telefone válidos.');
    setBusy(true);
    try {
      const response = await fetch(`/api/clients/profile-link/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, documentType, taxId: onlyDigits(form.taxId) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar os dados.');
      setSaved(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar os dados.');
    } finally {
      setBusy(false);
    }
  }

  if (saved) return <main className="auth-shell auth-simple"><section className="auth-panel"><div className="auth-card profile-link-card"><div className="auth-card-heading"><span className="auth-mobile-mark">N</span><span className="auth-eyebrow">Nexo · cadastro seguro</span><h2>Dados recebidos</h2><p>Obrigado. O cadastro foi salvo com segurança e este link não pode mais ser reutilizado.</p></div><div className="auth-feedback success"><CheckCircle2 size={17} /> Seus dados foram atualizados com sucesso.</div></div></section></main>;

  const isUpdate = initialData.purpose === 'update';
  const currentDocumentError = form.taxId ? documentError(documentType, form.taxId) : null;
  return <main className="auth-shell auth-simple"><section className="auth-panel"><div className="auth-card profile-link-card"><div className="auth-card-heading"><span className="auth-mobile-mark">N</span><span className="auth-eyebrow">{initialData.organization_name} · cadastro seguro</span><h2>{isUpdate ? 'Atualize seus dados' : 'Complete seu cadastro'}</h2><p>{isUpdate ? 'Revise as informações abaixo e corrija o que for necessário.' : 'Informe seus dados cadastrais para agilizar seu atendimento.'}</p><small className="profile-link-expiry">Link válido até {new Date(initialData.expires_at).toLocaleString('pt-BR')}</small></div><form className="auth-form profile-link-form" onSubmit={submit}>
    <div className="client-type-picker" role="group" aria-label="Tipo de pessoa"><button type="button" className={documentType === 'cpf' ? 'selected' : ''} onClick={() => { setDocumentType('cpf'); setForm(current => ({ ...current, documentType: 'cpf', taxId: '' })); }}>Pessoa física<small>CPF</small></button><button type="button" className={documentType === 'cnpj' ? 'selected' : ''} onClick={() => { setDocumentType('cnpj'); setForm(current => ({ ...current, documentType: 'cnpj', taxId: '' })); }}>Pessoa jurídica<small>CNPJ</small></button></div>
    <div className="form-grid"><label>{documentType === 'cpf' ? 'CPF' : 'CNPJ'}<input value={formatBrazilianDocument(documentType, form.taxId)} onChange={event => update('taxId', onlyDigits(event.target.value))} inputMode="numeric" placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} required={initialData.purpose === 'register'} />{currentDocumentError && <small className="field-error">{currentDocumentError}</small>}</label><label>Nome para atendimento<input value={form.fullName} onChange={event => update('fullName', event.target.value)} required placeholder="Nome completo ou nome fantasia" /></label>{documentType === 'cnpj' && <><label>Razão social<input value={form.legalName} onChange={event => update('legalName', event.target.value)} /></label><label>Nome fantasia<input value={form.tradeName} onChange={event => update('tradeName', event.target.value)} /></label></>}</div>
    <div className="form-grid"><label>Telefone<input value={form.phone} onChange={event => update('phone', event.target.value)} type="tel" required placeholder="(11) 90000-0000" /></label><label>E-mail<input value={form.email} onChange={event => update('email', event.target.value)} type="email" placeholder="cliente@email.com" /></label></div>
    <div className="address-heading"><div><span className="eyebrow">Endereço principal</span><h3>Onde podemos encontrar você</h3></div></div>
    <div className="form-grid"><label>CEP<input value={form.address.postalCode} onChange={event => updateAddress('postalCode', onlyDigits(event.target.value).slice(0, 8))} inputMode="numeric" placeholder="00000-000" /></label><label>Logradouro<input value={form.address.street} onChange={event => updateAddress('street', event.target.value)} placeholder="Rua, avenida…" /></label><label>Número<input value={form.address.number} onChange={event => updateAddress('number', event.target.value)} /></label><label>Complemento<input value={form.address.complement} onChange={event => updateAddress('complement', event.target.value)} /></label><label>Bairro<input value={form.address.neighborhood} onChange={event => updateAddress('neighborhood', event.target.value)} /></label><label>Cidade<input value={form.address.city} onChange={event => updateAddress('city', event.target.value)} /></label><label>UF<input value={form.address.state} onChange={event => updateAddress('state', event.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" /></label></div>
    <label className="full-label">Observações<textarea value={form.notes} onChange={event => update('notes', event.target.value)} rows={3} placeholder="Preferências de contato ou outras informações importantes." /></label><div className="form-hint"><ShieldCheck size={16} /> Seus dados serão usados somente para o cadastro e o atendimento junto à assistência.</div>{error && <div className="auth-feedback error">{error}</div>}<button className="button primary auth-submit" disabled={busy || Boolean(currentDocumentError)}>{busy ? 'Salvando…' : isUpdate ? 'Salvar atualização' : 'Enviar cadastro'}</button>
  </form></div></section></main>;
}
