'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/supabase/env';

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirm) return setError('As senhas precisam ser iguais.');
    if (!hasSupabaseConfig()) return setError('O acesso real ainda não foi configurado neste ambiente.');
    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    setMessage('Senha atualizada. Você já pode entrar novamente.');
  }

  return <main className="auth-shell auth-simple"><section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><span className="auth-mobile-mark">N</span><span className="auth-eyebrow">Segurança da conta</span><h2>Crie uma nova senha</h2><p>Escolha uma senha forte para continuar protegendo seu acesso.</p></div><form className="auth-form" onSubmit={submit}><label><span>Nova senha</span><div className="auth-input"><LockKeyhole size={17} /><input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required autoComplete="new-password" placeholder="Mínimo de 6 caracteres" /></div></label><label><span>Confirmar senha</span><div className="auth-input"><LockKeyhole size={17} /><input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={6} required autoComplete="new-password" placeholder="Repita sua senha" /></div></label>{error && <div className="auth-feedback error">{error}</div>}{message && <div className="auth-feedback success"><CheckCircle2 size={16} />{message}</div>}<button className="button primary auth-submit" disabled={busy}>{busy ? 'Aguarde…' : 'Atualizar senha'} {!busy && <ArrowRight size={17} />}</button></form><Link className="auth-link" href="/login">Voltar para o login</Link></div></section></main>;
}
