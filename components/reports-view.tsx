'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, RefreshCw, TrendingUp } from 'lucide-react';
import { money, type View } from '@/lib/demo';

type ReportData = {
  range: { from: string; until: string };
  unitId: string;
  role: string;
  units: Array<{ id: string; name: string; role: string }>;
  canViewFinance: boolean;
  kpis: {
    totalOrders: number; openOrders: number; completedOrders: number; overdueOrders: number;
    revenueCents: number | null; receivedCents: number | null; openBalanceCents: number | null; excludedReceivedCents: number | null;
    averageCompletionDays: number; quoteApprovalRate: number; approvedQuotes: number; sentQuotes: number;
    partsRevenueCents: number | null; partsCostCents: number | null; partsMarginCents: number | null;
    stockPhysical: number; stockReserved: number; stockAvailable: number; stockValueCents: number | null; lowStockCount: number;
  };
  statuses: Array<{ label: string; count: number }>;
  quotes: Array<{ status: string; count: number }>;
  lowStock: Array<{ id: string; code: string; name: string; physical: number; reserved: number; available: number; minimum: number; costCents: number | null }>;
  topConsumed: Array<{ id: string; code?: string; name?: string; quantity: number }>;
  alerts: Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string; action: string; actionLabel: string }>;
  recentOrders: Array<{ id: string; number: string; status: string; amountCents: number | null; balanceCents: number | null }>;
};

type Props = { liveMode: boolean; notify: (message: string, error?: boolean) => void; onNavigate: (view: View) => void };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const monthAgo = () => new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const amount = (value: number | null) => value == null ? '—' : money(value);
const statusLabel: Record<string, string> = { sent: 'Enviados', approved: 'Aprovados', rejected: 'Recusados', expired: 'Expirados' };

function Kpi({ label, value, detail, tone = 'blue', icon }: { label: string; value: string; detail: string; tone?: string; icon: React.ReactNode }) {
  return <article className={`reports-kpi reports-kpi-${tone}`}><span className="reports-kpi-icon">{icon}</span><small>{label}</small><strong>{value}</strong><em>{detail}</em></article>;
}

function ProgressRows({ rows, total }: { rows: Array<{ label: string; count: number }>; total: number }) {
  return <div className="reports-progress-list">{rows.map(row => <div className="reports-progress-row" key={row.label}><div><span>{row.label}</span><b>{row.count}</b></div><span className="reports-progress-track"><i style={{ width: `${total ? Math.max(4, row.count / total * 100) : 0}%` }} /></span></div>)}</div>;
}

export function ReportsView({ liveMode, notify, onNavigate }: Props) {
  const [from, setFrom] = useState(monthAgo);
  const [until, setUntil] = useState(today);
  const [unitId, setUnitId] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextUnitId = unitId) {
    if (!liveMode) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, until });
      if (nextUnitId) query.set('unitId', nextUnitId);
      const response = await fetch(`/api/reports?${query.toString()}`);
      const result = await response.json() as { data?: ReportData; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? 'Não foi possível gerar os relatórios.');
      setData(result.data);
      if (!nextUnitId) setUnitId(result.data.unitId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível gerar os relatórios.';
      setError(message);
      notify(message, true);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [liveMode]);

  if (!liveMode) return <section className="panel reports-empty"><BarChart3 size={28} /><h2>Relatórios conectados</h2><p>Conecte o Supabase para visualizar indicadores reais da operação.</p></section>;
  if (loading && !data) return <section className="panel reports-empty"><RefreshCw className="spin" size={24} /><p>Consolidando os dados da operação…</p></section>;
  if (error && !data) return <section className="panel reports-empty"><AlertTriangle size={24} /><p>{error}</p><button className="button secondary" onClick={() => void load()}>Tentar novamente</button></section>;
  if (!data) return null;

  const { kpis } = data;
  const statusTotal = data.statuses.reduce((sum, item) => sum + item.count, 0);
  const quoteTotal = data.quotes.reduce((sum, item) => sum + item.count, 0);
  const dateText = `${new Date(`${data.range.from}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${data.range.until}T12:00:00`).toLocaleDateString('pt-BR')}`;

  return <div className="reports-page">
    <section className="panel reports-filter-panel"><div><span className="eyebrow">Gestão baseada em dados</span><h2>Relatórios inteligentes</h2><p>Indicadores e alertas para decidir o que merece atenção agora.</p></div><div className="reports-filters"><label>Unidade<select value={unitId} onChange={event => { setUnitId(event.target.value); void load(event.target.value); }}>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>De<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Até<input type="date" value={until} min={from} onChange={event => setUntil(event.target.value)} /></label><button className="button secondary reports-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Atualizar</button></div></section>
    <div className="reports-kpi-grid">
      <Kpi label="OS no período" value={String(kpis.totalOrders)} detail={`${kpis.openOrders} em aberto`} icon={<BarChart3 size={17} />} />
      <Kpi label="Prazo vencido" value={String(kpis.overdueOrders)} detail={kpis.overdueOrders ? 'Requer atenção' : 'Nenhuma pendência'} tone={kpis.overdueOrders ? 'orange' : 'green'} icon={<Clock3 size={17} />} />
      <Kpi label="Valor das OS válidas" value={amount(kpis.revenueCents)} detail={amount(kpis.receivedCents) + ' recebido'} tone="purple" icon={<CircleDollarSign size={17} />} />
      <Kpi label="Estoque disponível" value={kpis.stockAvailable.toLocaleString('pt-BR')} detail={`${kpis.stockReserved.toLocaleString('pt-BR')} reservado`} tone="blue" icon={<PackageCheck size={17} />} />
      <Kpi label="Aprovação de orçamentos" value={`${Math.round(kpis.quoteApprovalRate * 100)}%`} detail={`${kpis.approvedQuotes} aprovados`} tone="green" icon={<CheckCircle2 size={17} />} />
      <Kpi label="Tempo médio de conclusão" value={kpis.averageCompletionDays ? `${kpis.averageCompletionDays.toFixed(1)} dias` : '—'} detail={`${kpis.completedOrders} concluídas`} tone="orange" icon={<TrendingUp size={17} />} />
    </div>
    {data.alerts.length > 0 && <section className="panel reports-alerts"><div className="reports-section-heading"><div><h3>Atenção recomendada</h3><p>O sistema encontrou situações que podem exigir uma ação.</p></div><span>{data.alerts.length} alerta{data.alerts.length === 1 ? '' : 's'}</span></div><div className="reports-alert-list">{data.alerts.map((alert, index) => <article className={`reports-alert reports-alert-${alert.severity}`} key={`${alert.title}-${index}`}><AlertTriangle size={17} /><div><b>{alert.title}</b><p>{alert.detail}</p></div><button className="button secondary compact" onClick={() => onNavigate(alert.action as View)}>{alert.actionLabel}</button></article>)}</div></section>}
    <div className="reports-columns">
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Fluxo das ordens</h3><p>Distribuição por status no período.</p></div><span>{statusTotal} OS</span></div><ProgressRows rows={data.statuses} total={statusTotal} /></section>
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Orçamentos</h3><p>Última versão por OS válida; canceladas e anuladas excluídas.</p></div><span>{Math.round(kpis.quoteApprovalRate * 100)}%</span></div><ProgressRows rows={data.quotes.map(item => ({ label: statusLabel[item.status] ?? item.status, count: item.count }))} total={quoteTotal} /></section>
    </div>
    <div className="reports-columns">
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Estoque que merece atenção</h3><p>Produtos na quantidade mínima ou abaixo dela.</p></div><button className="text-button" onClick={() => onNavigate('produtos')}>Abrir estoque</button></div>{data.lowStock.length ? <div className="reports-table">{data.lowStock.map(product => <div className="reports-table-row" key={product.id}><span><b>{product.name}</b><small>{product.code} · mínimo {product.minimum.toLocaleString('pt-BR')}</small></span><strong className={product.available <= product.minimum ? 'reports-danger-text' : ''}>{product.available.toLocaleString('pt-BR')} disponível</strong></div>)}</div> : <div className="reports-success-note"><CheckCircle2 size={17} /> Nenhum produto abaixo do mínimo.</div>}</section>
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Peças mais utilizadas</h3><p>Consumo registrado no período.</p></div><button className="text-button" onClick={() => onNavigate('produtos')}>Ver produtos</button></div>{data.topConsumed.length ? <div className="reports-table">{data.topConsumed.map(product => <div className="reports-table-row" key={product.id}><span><b>{product.name ?? 'Produto'}</b><small>{product.code ?? '—'}</small></span><strong>{product.quantity.toLocaleString('pt-BR')} un.</strong></div>)}</div> : <div className="reports-muted-note">Nenhum consumo de peça registrado no período.</div>}</section>
    </div>
    <div className="reports-columns">
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Financeiro</h3><p>OS válidas, incluindo concluídas. Peças após desconto proporcional.</p></div><button className="text-button" onClick={() => onNavigate('financeiro')}>Abrir financeiro</button></div>{data.canViewFinance ? <div className="reports-finance-grid"><span>Em aberto<b>{amount(kpis.openBalanceCents)}</b></span><span>Venda de peças<b>{amount(kpis.partsRevenueCents)}</b></span><span>Margem de peças<b>{kpis.partsMarginCents == null ? 'Custo pendente' : amount(kpis.partsMarginCents)}</b></span><span>Valor do estoque<b>{amount(kpis.stockValueCents)}</b></span><span>Recebimentos de canceladas/anuladas · conferir<b>{amount(kpis.excludedReceivedCents)}</b></span></div> : <div className="reports-muted-note">Seu perfil pode consultar os indicadores operacionais, mas não os valores financeiros.</div>}</section>
      <section className="panel reports-card"><div className="reports-section-heading"><div><h3>Últimas ordens do período</h3><p>Atendimentos mais recentes.</p></div><button className="text-button" onClick={() => onNavigate('ordens')}>Ver ordens</button></div><div className="reports-table">{data.recentOrders.slice(0, 5).map(order => <div className="reports-table-row" key={order.id}><span><b>{order.number}</b><small>{order.status}</small></span><strong>{data.canViewFinance ? amount(order.balanceCents) : '—'}</strong></div>)}</div></section>
    </div>
    <p className="reports-footnote">Período analisado: {dateText}. OS filtradas pela data de abertura e pela unidade. Valores e recebimentos acumulados dessas OS; canceladas e anuladas excluídas dos totais comerciais. Recebimentos dessas ordens são exibidos separadamente. Estoque representa o saldo atual.</p>
  </div>;
}
