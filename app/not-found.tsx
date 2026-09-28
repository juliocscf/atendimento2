import Link from 'next/link';
export default function NotFound() { return <main className="not-found"><span className="eyebrow">NEXO · 404</span><h1>Esta página não foi encontrada.</h1><p>Volte ao painel para continuar o atendimento.</p><Link className="button primary" href="/">Voltar ao painel</Link></main>; }
