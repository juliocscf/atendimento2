'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function OnboardingForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [unitName, setUnitName] = useState('Matriz · Centro');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName, unitName, slug }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) return setError(result?.error ?? 'Não foi possível concluir a configuração.');
    router.push('/');
  }

  return <main className="auth-shell auth-simple"><section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><span className="auth-mobile-mark">N</span><span className="auth-eyebrow">Primeira configuração</span><h2>Configure sua assistência</h2><p>Comece com a organização e a primeira unidade. Você poderá adicionar filiais depois.</p></div><form className="auth-form" onSubmit={submit}><label><span>Nome da assistência</span><div className="auth-input"><Store size={17} /><input value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="Ex.: Nexo Tecnologia" minLength={3} required /></div></label><label><span>Primeira unidade</span><div className="auth-input"><MapPin size={17} /><input value={unitName} onChange={event => setUnitName(event.target.value)} placeholder="Ex.: Matriz · Centro" minLength={2} required /></div></label><label><span>Identificador opcional</span><input value={slug} onChange={event => setSlug(event.target.value)} placeholder="ex.: nexo-tecnologia" /></label>{error && <div className="auth-feedback error">{error}</div>}<button className="button primary auth-submit" disabled={busy}>{busy ? 'Salvando…' : 'Continuar'} {!busy && <ArrowRight size={17} />}</button></form><div className="auth-demo-note"><CheckCircle2 size={14} /> Você será a primeira gestora desta organização.</div></div></section></main>;
}
