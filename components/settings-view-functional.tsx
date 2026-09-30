'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, ShieldCheck, Store, Users } from 'lucide-react';
import { OperationalHealth } from '@/components/operational-health';

type Notify = (message: string, error?: boolean) => void;
type Tab = 'unit' | 'team' | 'notifications' | 'security';

const STORAGE_KEY = 'nexo.settings.preferences';

type SettingsState = {
  organizationName: string;
  unitName: string;
  phone: string;
  timezone: string;
  conflicts: boolean;
  pendingBalance: boolean;
};

const initialSettings: SettingsState = {
  organizationName: 'Nexo Assistência',
  unitName: 'Matriz · Centro',
  phone: '(11) 3333-1010',
  timezone: 'America/Sao_Paulo',
  conflicts: true,
  pendingBalance: true,
};

function readStoredSettings(): SettingsState {
  if (typeof window === 'undefined') return initialSettings;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SettingsState> | null;
    return { ...initialSettings, ...(parsed ?? {}) };
  } catch {
    return initialSettings;
  }
}

export function FunctionalSettingsView({ notify, reset, liveMode = false }: { notify: Notify; reset: () => void; liveMode?: boolean }) {
  const [tab, setTab] = useState<Tab>('unit');
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [role, setRole] = useState('Gestora');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(liveMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!liveMode) {
      setSettings(readStoredSettings());
      return;
    }
    let cancelled = false;
    void fetch('/api/settings').then(async response => {
      const payload = await response.json() as { data?: Partial<SettingsState> & { role?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível carregar as configurações.');
      if (!cancelled) {
        setSettings(current => ({ ...current, ...payload.data, conflicts: current.conflicts, pendingBalance: current.pendingBalance }));
        setRole(payload.data?.role ?? 'Equipe');
      }
    }).catch(error => {
      if (!cancelled) notify(error instanceof Error ? error.message : 'Não foi possível carregar as configurações.', true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [liveMode, notify]);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings(current => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      if (liveMode) {
        const response = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        const payload = await response.json() as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Não foi possível salvar as configurações.');
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
      setSaved(true);
      notify(liveMode ? 'Configurações salvas no banco de dados.' : 'Preferências salvas nesta demonstração.');
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.', true);
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Store }> = [
    { id: 'unit', label: 'Unidade', icon: Store },
    { id: 'team', label: 'Equipe e permissões', icon: Users },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: ShieldCheck },
  ];

  return <div className="settings-layout">
    <div className="settings-nav">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17} /> {item.label}</button>; })}</div>
    <section className="panel settings-panel">
      {loading ? <div className="settings-loading">Carregando configurações…</div> : <>
        {tab === 'unit' && <div className="settings-section"><span className="eyebrow">Identidade da operação</span><h2>Como sua equipe reconhece a assistência</h2><p>Essas informações aparecem em documentos e na navegação da equipe.</p><div className="form-grid"><label>Nome da assistência<input value={settings.organizationName} onChange={event => update('organizationName', event.target.value)} /></label><label>Unidade ativa<input value={settings.unitName} onChange={event => update('unitName', event.target.value)} /></label><label>Telefone principal<input value={settings.phone} onChange={event => update('phone', event.target.value)} /></label><label>Fuso horário<select value={settings.timezone} onChange={event => update('timezone', event.target.value)}><option value="America/Sao_Paulo">Brasília (GMT−3)</option><option value="America/Manaus">Manaus (GMT−4)</option><option value="America/Noronha">Fernando de Noronha (GMT−2)</option></select></label></div></div>}
        {tab === 'team' && <div className="settings-section"><span className="eyebrow">Equipe e permissões</span><h2>Seu acesso à assistência</h2><p>O acesso é controlado pelo seu vínculo ativo no banco de dados.</p><div className="team-card"><span className="avatar">{role.slice(0, 2).toUpperCase()}</span><div><b>Usuário autenticado</b><small>Perfil atual · {role}</small></div><span className="status-pill status-green"><span className="status-dot" />Ativo</span></div></div>}
        {tab === 'notifications' && <div className="settings-section"><span className="eyebrow">Preferências de operação</span><h2>O que a equipe vê primeiro</h2><Preference label="Alertar conflitos na agenda" description="Impedir confirmação sem tratar sobreposição de horários." checked={settings.conflicts} onChange={value => update('conflicts', value)} /><Preference label="Exigir justificativa ao entregar com saldo pendente" description="Registrar a decisão do gestor no histórico da OS." checked={settings.pendingBalance} onChange={value => update('pendingBalance', value)} /></div>}
        {tab === 'security' && <div className="settings-section"><span className="eyebrow">Segurança</span><h2>Sessão protegida</h2><p>Sua sessão é autenticada pelo Supabase e as permissões são verificadas no servidor.</p><div className="security-card"><ShieldCheck size={20} /><div><b>Proteção ativa</b><small>Políticas de acesso por organização e unidade estão em vigor.</small></div></div></div>}
        <OperationalHealth notify={notify} />
        <div className="settings-footer"><button className="button secondary" onClick={() => { reset(); setSettings(initialSettings); window.localStorage.removeItem(STORAGE_KEY); notify('Demonstração restaurada com sucesso.'); }}>Restaurar demonstração</button><button className="button primary" disabled={saving} onClick={() => void save()}>{saved ? <><Check size={17} /> Salvo</> : saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
      </>}
    </section>
  </div>;
}

function Preference({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="preference"><span><b>{label}</b><small>{description}</small></span><button type="button" className={`toggle ${checked ? 'on' : ''}`} aria-label={`${label} ${checked ? 'ativado' : 'desativado'}`} aria-pressed={checked} onClick={() => onChange(!checked)}><span /></button></div>;
}
