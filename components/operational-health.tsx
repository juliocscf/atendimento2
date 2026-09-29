'use client';

import { useEffect, useState } from 'react';
import { Check, CircleAlert, RefreshCw } from 'lucide-react';

type HealthResult = { table: string; reachable: boolean; visibleRows: number; error: string | null };

export function OperationalHealth({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [checks, setChecks] = useState<HealthResult[]>([]);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/health/operational', { cache: 'no-store' });
      const result = await response.json() as { reachable?: boolean; checks?: HealthResult[] };
      setReachable(result.reachable ?? false);
      setChecks(result.checks ?? []);
      if (!response.ok) notify('A verificação operacional encontrou uma indisponibilidade.', true);
    } catch { setReachable(false); notify('Não foi possível consultar a saúde da aplicação.', true); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  return <div className="settings-section"><span className="eyebrow">Prontidão operacional</span><h2>Saúde da aplicação</h2><p>Consulta somente leitura das áreas críticas visíveis para sua sessão.</p><div className="health-status"><span className={`health-dot ${reachable === true ? 'ok' : reachable === false ? 'error' : ''}`} />{reachable === true ? 'Todos os serviços respondendo' : reachable === false ? 'Requer atenção' : 'Verificando…'}<button className="button secondary compact" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />{loading ? 'Atualizando…' : 'Atualizar'}</button></div>{checks.length > 0 && <div className="health-grid">{checks.map(check => <div className="health-check" key={check.table}>{check.reachable ? <Check size={14} /> : <CircleAlert size={14} />}<span>{check.table}</span><small>{check.reachable ? `${check.visibleRows} visíveis` : 'indisponível'}</small></div>)}</div>}</div>;
}
