'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { money, normalize } from '@/lib/demo';
import { CATALOG_STORAGE_KEY, serviceInput, type CatalogService } from '@/lib/service-catalog';
const blank = () => ({ id: '', code: '', name: '', description: '', category: '', price: '', is_active: true });
export function ServicesView({ liveMode, notify }: { liveMode: boolean; notify: (message: string, error?: boolean) => void }) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [canManage, setCanManage] = useState(!liveMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!liveMode) {
          const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) ?? '[]');
          if (active) setServices(Array.isArray(saved) ? saved.filter(item => typeof item?.id === 'string' && serviceInput(item)) : []);
          return;
        }
        const response = await fetch('/api/services');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) { setServices(result.data); setCanManage(result.canManage); }
      } catch { if (active) setError('Não foi possível carregar o catálogo. Atualize a página para tentar novamente.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [liveMode]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    const price = Number(form.price.replace(/\./g, '').replace(',', '.'));
    const values = serviceInput({ ...form, default_price_cents: Math.round(price * 100) });
    if (!values || !form.price.trim()) return notify('Confira código, nome e preço do serviço.', true);
    if (services.some(service => service.code === values.code && service.id !== form.id)) return notify('Já existe um serviço com este código.', true);
    setSaving(true);
    try {
      let saved: CatalogService = { ...values, id: form.id || crypto.randomUUID() };
      if (liveMode) {
        const response = await fetch('/api/services', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, id: form.id || undefined }) });
        const result = await response.json();
        if (!response.ok) return notify(result.error ?? 'Não foi possível salvar.', true);
        saved = result.data;
      }
      const next = [...services.filter(service => service.id !== saved.id), saved].sort((a, b) => a.code.localeCompare(b.code));
      if (!liveMode) localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
      setServices(next); setForm(null); notify('Serviço salvo. Orçamentos anteriores mantêm seus dados.');
    } catch { notify('Não foi possível salvar o serviço.', true); }
    finally { setSaving(false); }
  }
  const filtered = services.filter(service => normalize(`${service.code} ${service.name}`).includes(normalize(query)) && (status === 'all' || service.is_active === (status === 'active')));
  return <div className="view-stack"><section className="panel service-catalog-panel">
    <div className="service-catalog-toolbar"><div><h2>Catálogo de serviços</h2><p>Preços padrão de mão de obra. Peças são incluídas separadamente no orçamento.</p></div>{canManage && <button className="button primary" onClick={() => setForm(blank())}>Cadastrar serviço</button>}</div>
    <div className="service-catalog-filters"><label>Pesquisar código ou nome<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: SRV-001 ou limpeza" /></label><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label></div>
    {loading && <p>Carregando serviços…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && !filtered.length && <p>Nenhum serviço encontrado. Cadastre os serviços oferecidos pela assistência.</p>}
    <div className="service-catalog-list">{filtered.map(service => <article key={service.id}><div><b>{service.code} · {service.name}</b><small>{service.category || 'Sem categoria'} · {service.is_active ? 'Ativo' : 'Inativo'}</small><p>{service.description || 'Sem descrição adicional'}</p></div><div className="service-catalog-actions"><strong>{money(service.default_price_cents)}</strong>{canManage && <button className="button secondary compact" onClick={() => setForm({ ...service, price: (service.default_price_cents / 100).toFixed(2).replace('.', ',') })}>Editar {service.code}</button>}</div></article>)}</div>
  </section>{form && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="service-form-title"><header><div><h2 id="service-form-title">{form.id ? 'Editar serviço' : 'Cadastrar serviço'}</h2><p>Alterações valem para seleções futuras; propostas anteriores são preservadas.</p></div><button className="icon-button" aria-label="Fechar cadastro de serviço" onClick={() => !saving && setForm(null)}>×</button></header><div className="modal-body"><form onSubmit={save}><div className="form-grid"><label>Código<input value={form.code} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,29}" onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="SRV-001" required /></label><label>Nome do serviço<input value={form.name} maxLength={120} minLength={2} onChange={event => setForm({ ...form, name: event.target.value })} required /></label><label>Categoria<input value={form.category} maxLength={80} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Manutenção" /></label><label>Preço padrão da mão de obra (R$)<input inputMode="decimal" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="0,00" required /></label><label>Situação<select value={form.is_active ? 'active' : 'inactive'} onChange={event => setForm({ ...form, is_active: event.target.value === 'active' })}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label></div><label className="full-label">Descrição padrão<textarea rows={4} maxLength={2000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><div className="modal-footer"><button type="button" className="button secondary" disabled={saving} onClick={() => setForm(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar serviço'}</button></div></form></div></section></div>}</div>;
}
