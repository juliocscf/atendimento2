'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/supabase/env';

type Mode = 'login' | 'signup' | 'reset';

function nextPath() {
  if (typeof window === 'undefined') return '/';
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/') ? next : '/';
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setMessage('');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!hasSupabaseConfig()) {
      setError('O acesso real ainda não foi configurado neste ambiente.');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    if (mode === 'reset') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      setBusy(false);
      if (resetError) return setError(resetError.message);
      return setMessage('Enviamos um link para redefinir sua senha.');
    }

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setBusy(false);
      if (signUpError) return setError(signUpError.message);
      if (data.session) return window.location.assign(nextPath());
      return setMessage('Confira seu e-mail para confirmar o acesso.');
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return setError('E-mail ou senha inválidos.');
    const { data: membership } = await supabase.from('unit_memberships').select('organization_id').limit(1).maybeSingle();
    window.location.assign(membership ? nextPath() : '/onboarding');
  }

  const isReset = mode === 'reset';
  const isSignup = mode === 'signup';

  return <main className="auth-shell">
    <section className="auth-showcase">
      <div className="auth-brand"><span className="brand-mark">N</span><span><b>Nexo</b><small>gestão da assistência</small></span></div>
      <div className="auth-showcase-copy"><span className="auth-kicker"><Sparkles size={14} /> Operação mais clara, todos os dias</span><h1>Atenda melhor.<br /><em>Entregue confiança.</em></h1><p>Clientes, equipamentos e ordens de serviço em um só lugar.</p></div>
      <div className="auth-benefits"><span><CheckCircle2 size={17} /> Histórico completo por equipamento</span><span><CheckCircle2 size={17} /> Acesso por equipe e unidade</span><span><CheckCircle2 size={17} /> Segurança desde a entrada</span></div>
      <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-card-heading"><span className="auth-mobile-mark">N</span><span className="auth-eyebrow">{isReset ? 'Recuperar acesso' : isSignup ? 'Primeiro acesso' : 'Área da equipe'}</span><h2>{isReset ? 'Redefina sua senha' : isSignup ? 'Crie seu acesso' : 'Bem-vinda de volta'}</h2><p>{isReset ? 'Enviaremos um link seguro para o seu e-mail.' : isSignup ? 'Cadastre seu acesso de gestora para começar.' : 'Entre para acompanhar a operação da assistência.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          {isSignup && <label>Nome completo<input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Ex.: Marina Azevedo" required autoComplete="name" /></label>}
          <label><span>E-mail</span><div className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@assistencia.com.br" required autoComplete="email" /></div></label>
          {!isReset && <label><span>Senha</span><div className="auth-input"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
          {error && <div className="auth-feedback error"><ShieldCheck size={16} />{error}</div>}
          {message && <div className="auth-feedback success"><CheckCircle2 size={16} />{message}</div>}
          <button className="button primary auth-submit" disabled={busy}>{busy ? 'Aguarde…' : isReset ? 'Enviar link de recuperação' : isSignup ? 'Criar acesso' : 'Entrar'} {!busy && <ArrowRight size={17} />}</button>
        </form>
        {!isReset && <button className="auth-link muted" onClick={() => switchMode('reset')}>Esqueci minha senha</button>}
        {isReset ? <button className="auth-link" onClick={() => switchMode('login')}>Voltar para o login</button> : <p className="auth-switch">{isSignup ? 'Já possui acesso?' : 'Ainda não possui acesso?'} <button onClick={() => switchMode(isSignup ? 'login' : 'signup')}>{isSignup ? 'Entrar' : 'Criar acesso'}</button></p>}
        {!hasSupabaseConfig() && <div className="auth-demo-note">Modo demonstração ativo. Configure o Supabase para habilitar o acesso real.</div>}
      </div>
      <small className="auth-footer"><LockKeyhole size={13} /> Seus dados são protegidos por autenticação segura.</small>
    </section>
  </main>;
}
