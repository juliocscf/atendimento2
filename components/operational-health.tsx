'use client';

import { useEffect, useState } from 'react';
import { Check, CircleAlert, Download, RefreshCw } from 'lucide-react';

type HealthResult = { table: string; reachable: boolean; visibleRows: number; error: string | null };

export function OperationalHealth({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [checks, setChecks] = useState<HealthResult[]>([]);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  async function exportData() {
    setExporting(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) { const result = await response.json() as { error?: string }; notify(result.error ?? 'Não foi possível exportar os dados.', true); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `atendimento-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify('Backup JSON exportado com sucesso.');
    } catch { notify('Não foi possível exportar os dados.', true); }
    finally { setExporting(false); }
  }
  return <div className="settings-section"><span className="eyebrow">Prontidão operacional</span><h2>Saúde da aplicação</h2><p>Consulta somente leitura das áreas críticas visíveis para sua sessão.</p><div className="health-status"><span className={`health-dot ${reachable === true ? 'ok' : reachable === false ? 'error' : ''}`} />{reachable === true ? 'Todos os serviços respondendo' : reachable === false ? 'Requer atenção' : 'Verificando…'}<button className="button secondary compact" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />{loading ? 'Atualizando…' : 'Atualizar'}</button><button className="button secondary compact" onClick={() => void exportData()} disabled={exporting}><Download size={14} />{exporting ? 'Exportando…' : 'Exportar dados'}</button></div>{checks.length > 0 && <div className="health-grid">{checks.map(check => <div className="health-check" key={check.table}>{check.reachable ? <Check size={14} /> : <CircleAlert size={14} />}<span>{check.table}</span><small>{check.reachable ? `${check.visibleRows} visíveis` : 'indisponível'}</small></div>)}</div>}</div>;
}
