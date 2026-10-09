'use client';

import { AlertTriangle, ArrowDownRight, ChevronRight, CircleDollarSign, CreditCard } from 'lucide-react';
import { FinanceBreakdownReport } from '@/components/finance-breakdown-report';
import { isFinanciallyValid, orderBalance, summarizeOrderFinance } from '@/lib/order-finance';
import { isLate, money, type DemoData, type Order } from '@/lib/demo';

type Props = {
  data: DemoData;
  clientName: (id: string) => string;
  onOrder: (order: Order) => void;
  onNew?: () => void;
};

export function FinanceViewDesign({ data, clientName, onOrder, onNew }: Props) {
  const summary = summarizeOrderFinance(data.orders);
  const validOrders = data.orders.filter(order => isFinanciallyValid(order.status));
  const pendingOrders = data.orders.filter(order => orderBalance(order) > 0);
  const overdueOrders = pendingOrders.filter(isLate);
  const excludedOrders = data.orders.filter(order => !isFinanciallyValid(order.status) && order.paid > 0);

  return <div className="view-stack finance-view-design">
    <section className="panel finance-overview-panel">
      <div className="finance-overview-heading">
        <div>
          <span className="eyebrow">Conciliação financeira</span>
          <h2>OS válidas</h2>
          <p>Valores dos atendimentos válidos, separados do histórico cancelado.</p>
        </div>
        <span className="finance-summary-badge">{validOrders.length} OS válidas</span>
      </div>
      <div className="finance-cards finance-overview-cards">
        <FinanceMetric icon={<CircleDollarSign />} label="Total das OS válidas" value={money(summary.amount)} detail={`${validOrders.length} OS consideradas`} color="blue" />
        <FinanceMetric icon={<CreditCard />} label="Recebido" value={money(summary.received)} detail="Pagamentos registrados" color="green" />
        <FinanceMetric icon={<ArrowDownRight />} label="A receber" value={money(summary.balance)} detail={`${pendingOrders.length} OS com saldo${overdueOrders.length ? ` · ${overdueOrders.length} em atraso` : ''}`} color="purple" />
      </div>
    </section>

    {excludedOrders.length > 0 && <section className="panel finance-excluded-panel">
      <div className="finance-section-heading">
        <div>
          <span className="section-label"><AlertTriangle size={16} /> Conferência necessária</span>
          <h3>Recebimentos de OS canceladas ou anuladas</h3>
          <p>Ficam fora da receita e do saldo a cobrar, mas permanecem no histórico para conferência. Nenhum reembolso foi registrado automaticamente.</p>
        </div>
        <strong>{money(summary.excludedReceived)}</strong>
      </div>
      <div className="finance-excluded-list">
        {excludedOrders.map(order => <div className="finance-excluded-row" key={order.id}>
          <button className="finance-order-link" onClick={() => onOrder(order)}>{order.number}</button>
          <span className={`status-pill ${order.status === 'Cancelada' ? 'status-red' : 'status-orange'}`}><span className="status-dot" />{order.status}</span>
          <b>{money(order.paid)}</b>
          <ChevronRight size={16} />
        </div>)}
      </div>
    </section>}

    <FinanceBreakdownReport orders={data.orders} clientName={clientName} onOrder={onOrder} />

    <section className="panel full-panel finance-pending-panel">
      <div className="panel-header">
        <div><h3>Valores pendentes</h3><span>Recebimentos registrados e saldo por OS</span></div>
        <button className="panel-link" onClick={onNew}>Registrar recebimento <ChevronRight size={15} /></button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>OS</th><th>Cliente</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Situação</th><th /></tr></thead><tbody>
        {pendingOrders.map(order => <tr className="clickable-row" key={order.id} onClick={() => onOrder(order)}>
          <td><b className="order-number">{order.number}</b></td>
          <td>{clientName(order.clientId)}</td>
          <td>{money(order.amount)}</td>
          <td>{money(order.paid)}</td>
          <td><b>{money(orderBalance(order))}</b></td>
          <td><span className={`status-pill ${isLate(order) ? 'late' : 'status-orange'}`}><span className="status-dot" />{isLate(order) ? 'Atrasado' : 'Pendente'}</span></td>
          <td><ChevronRight size={17} /></td>
        </tr>)}
      </tbody></table></div>
      {!pendingOrders.length && <p className="finance-empty-state">Nenhuma OS com saldo pendente.</p>}
    </section>
  </div>;
}

function FinanceMetric({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: string; detail: string; color: string }) {
  return <div className="metric-card finance-summary-metric">
    <span className={`metric-icon ${color}`}>{icon}</span>
    <div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </div>;
}
