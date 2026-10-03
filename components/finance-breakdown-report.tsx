'use client';

import { useState } from 'react';
import { money, type Order } from '@/lib/demo';
import { type FinancialBreakdown, unclassifiedBreakdown } from '@/lib/quote-finance';

export function FinanceBreakdownReport({ orders, clientName, onOrder }: { orders: Order[]; clientName: (id: string) => string; onOrder: (order: Order) => void }) {
  const [category, setCategory] = useState('Todos');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const rows = orders.map(order => ({ order, breakdown: order.financialBreakdown ?? unclassifiedBreakdown(order.amount) })).filter(({ order, breakdown }) => {
    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '';
    return (category === 'Todos' || breakdown.category === category) && (!from || !!date && date >= from) && (!until || !!date && date <= until);
  });
  const sum = (key: keyof Pick<FinancialBreakdown, 'partsCents' | 'laborCents' | 'unclassifiedCents' | 'partsCostCents' | 'missingCostItems'>) => rows.reduce((total, row) => total + row.breakdown[key], 0);
  const margin = rows.some(row => row.breakdown.partsMarginCents == null) ? null : rows.reduce((total, row) => total + (row.breakdown.partsMarginCents ?? 0), 0);
  return <section className="panel full-panel finance-breakdown-report">
    <div className="finance-report-heading"><h2>Peças e mão de obra</h2><p>Valores das OS conforme orçamento aprovado, após desconto proporcional. Não representam recebimentos. Filtre pela data de abertura do atendimento.</p></div>
    <div className="finance-report-filters"><label>Tipo de atendimento<select value={category} onChange={event => setCategory(event.target.value)}>{['Todos', 'Somente peças', 'Somente mão de obra', 'Peças com mão de obra', 'Classificação pendente', 'Sem itens'].map(value => <option key={value}>{value}</option>)}</select></label><label>Abertura a partir de<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Abertura até<input type="date" min={from || undefined} value={until} onChange={event => setUntil(event.target.value)} /></label></div>
    <div className="finance-report-totals"><span>Venda de peças<b>{money(sum('partsCents'))}</b></span><span>Mão de obra<b>{money(sum('laborCents'))}</b></span><span>Custo das peças informado<b>{money(sum('partsCostCents'))}</b></span><span>Margem das peças<b>{margin == null ? 'Custo pendente' : money(margin)}</b></span><span>Não classificado<b>{money(sum('unclassifiedCents'))}</b></span></div>
    {sum('missingCostItems') > 0 && <p className="finance-report-note">Informe o custo de todas as peças para calcular a margem completa.</p>}
    <div className="table-wrap"><table><thead><tr><th>OS / cliente</th><th>Tipo</th><th>Peças</th><th>Mão de obra</th><th>Não classificado</th><th>Custo das peças</th><th>Margem das peças</th><th>Total</th></tr></thead><tbody>{rows.map(({ order, breakdown: b }) => <tr key={order.id}><td><button className="finance-order-link" onClick={() => onOrder(order)}>{order.number}</button><small>{clientName(order.clientId)}</small></td><td>{b.category}</td><td>{money(b.partsCents)}</td><td>{money(b.laborCents)}</td><td>{money(b.unclassifiedCents)}</td><td>{money(b.partsCostCents)}</td><td>{b.partsMarginCents == null ? 'Custo pendente' : money(b.partsMarginCents)}</td><td><b>{money(order.amount)}</b></td></tr>)}</tbody></table></div>
    <div className="finance-report-mobile">{rows.map(({ order, breakdown: b }) => <button key={order.id} onClick={() => onOrder(order)}><b>{order.number} · {clientName(order.clientId)}</b><span>{b.category}</span><span>Peças {money(b.partsCents)} · Mão de obra {money(b.laborCents)}</span>{b.unclassifiedCents > 0 && <span>Não classificado {money(b.unclassifiedCents)}</span>}<span>Custo informado {money(b.partsCostCents)} · Margem {b.partsMarginCents == null ? 'pendente' : money(b.partsMarginCents)}</span><strong>Total {money(order.amount)}</strong></button>)}</div>
    {!rows.length && <p className="finance-report-note">Nenhum atendimento encontrado para estes filtros.</p>}
  </section>;
}
