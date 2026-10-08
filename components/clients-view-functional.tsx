'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Laptop, Link2, ListFilter, X } from 'lucide-react';
import { type Client, type Device, type Order, dateLabel, initials, normalize } from '@/lib/demo';
import { ClientRegistrationModal } from './client-registration-modal';

export function clientOrders(orders: Order[], clientId: string) {
  return orders.filter(order => order.clientId === clientId).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.number.localeCompare(a.number, 'pt-BR', { numeric: true }));
}

export function ClientsView({ data, search, liveMode, liveLoading, loadError, onRetry, onNew, onClient, onProfileLink }: {
  data: { clients: Client[]; devices: Device[]; orders: Order[] }; search: string; liveLoading?: boolean; loadError?: string;
  liveMode: boolean; onRetry: () => void; onNew: () => void; onClient: (client: Client) => void; onProfileLink: (clientId?: string) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [person, setPerson] = useState('all');
  const [activity, setActivity] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const q = normalize(search.trim());
  const clients = data.clients.filter(client => {
    const orders = clientOrders(data.orders, client.id);
    const count = data.devices.filter(device => device.clientId === client.id).length;
    return (!q || [client.name, client.phone, client.email, client.taxId ?? '', client.legalName ?? '', client.tradeName ?? ''].some(value => normalize(value).includes(q) || (!!search.replace(/\D/g, '') && value.replace(/\D/g, '').includes(search.replace(/\D/g, '')))))
      && (person === 'all' || (client.documentType ?? 'cpf') === person)
      && (activity === 'all' || (activity === 'new' ? !orders.length : activity === 'ongoing' ? orders.some(order => order.status !== 'Concluído') : orders.length > 0 && orders.every(order => order.status === 'Concluído')))
      && (equipment === 'all' || (equipment === 'with' ? count > 0 : count === 0));
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : sort === 'equipment' ? data.devices.filter(d => d.clientId === b.id).length - data.devices.filter(d => d.clientId === a.id).length : (clientOrders(data.orders, b.id)[0]?.createdAt ?? '').localeCompare(clientOrders(data.orders, a.id)[0]?.createdAt ?? ''));
  const pages = Math.max(1, Math.ceil(clients.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = clients.slice((currentPage - 1) * 20, currentPage * 20);
  const active = person !== 'all' || activity !== 'all' || equipment !== 'all';
  function clear() { setPerson('all'); setActivity('all'); setEquipment('all'); setPage(1); }
  const status = (client: Client) => { const orders = clientOrders(data.orders, client.id); return !orders.length ? 'Novo' : orders.some(order => order.status !== 'Concluído') ? 'Em atendimento' : 'Sem atendimento aberto'; };
  return <div className="view-stack">
    <div className="list-toolbar"><span>{liveLoading ? 'Carregando clientes…' : `${clients.length} ${clients.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`}</span><div><button className="button secondary" onClick={() => onProfileLink()} disabled={!liveMode || Boolean(loadError) || liveLoading}><Link2 size={16} /> Link de cadastro</button><button className="button secondary" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><ListFilter size={16} /> Filtrar{active ? ' •' : ''}</button><button className="button primary" onClick={onNew} disabled={Boolean(loadError) || liveLoading}>+ Novo cliente</button></div></div>
    {showFilters && <section className="panel client-filter-panel" aria-label="Filtros de clientes"><div className="form-grid">
      <label>Tipo de pessoa<select value={person} onChange={e => {setPerson(e.target.value); setPage(1);}}><option value="all">Todos</option><option value="cpf">Pessoa física</option><option value="cnpj">Pessoa jurídica</option></select></label>
      <label>Atendimento<select value={activity} onChange={e => {setActivity(e.target.value); setPage(1);}}><option value="all">Todos</option><option value="new">Sem histórico de OS</option><option value="ongoing">Com OS em andamento</option><option value="completed">Somente OS concluídas</option></select></label>
      <label>Equipamentos<select value={equipment} onChange={e => {setEquipment(e.target.value); setPage(1);}}><option value="all">Todos</option><option value="with">Com equipamentos</option><option value="without">Sem equipamentos</option></select></label>
      <label>Ordenar por<select value={sort} onChange={e => {setSort(e.target.value); setPage(1);}}><option value="name">Nome</option><option value="recent">Último atendimento</option><option value="equipment">Quantidade de equipamentos</option></select></label>
    </div><button className="button secondary" onClick={clear}>Limpar filtros</button></section>}
    {loadError ? <section className="panel client-filter-panel" role="alert"><p>{loadError}</p><button className="button secondary" onClick={onRetry}>Tentar novamente</button></section> : <section className="panel full-panel">
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Equipamentos</th><th>Último atendimento</th><th>Status</th><th /></tr></thead><tbody>{visible.map(client => {
        const devices = data.devices.filter(d => d.clientId === client.id); const last = clientOrders(data.orders, client.id)[0];
        return <tr key={client.id} className="clickable-row" onClick={() => onClient(client)}><td><button className="client-name-button" onClick={() => onClient(client)} aria-label={`Abrir ficha de ${client.name}`}><span className="person-cell"><span className="avatar">{initials(client.name)}</span><span><b>{client.name}</b><small>{client.email}</small></span></span></button></td><td><span>{client.phone}</span><small>{client.address}</small></td><td><span className="device-count"><Laptop size={15} /> {devices.length} {devices.length === 1 ? 'equipamento' : 'equipamentos'}</span><small>{devices.map(d => d.code).join(' · ')}</small></td><td>{last ? <><b>{last.number}</b><small>{last.createdAt ? dateLabel(last.createdAt.slice(0, 10)) : 'Data não informada'}</small></> : <span className="muted">Ainda sem OS</span>}</td><td><span className="status-pill status-neutral">{status(client)}</span></td><td><button className="plain-icon" aria-label={`Ver detalhes de ${client.name}`} onClick={() => onClient(client)}><ChevronRight size={17}/></button></td></tr>;
      })}</tbody></table></div>
      <div className="client-cards">{visible.map(client => <button className="client-card client-mobile-button" key={client.id} onClick={() => onClient(client)}><b>{client.name}</b><span>{client.phone}</span><small>{status(client)} · {data.devices.filter(d => d.clientId === client.id).length} equipamentos</small></button>)}</div>
      {!clients.length && !liveLoading && <div className="client-filter-panel"><h3>Nenhum cliente encontrado</h3><p>Altere a busca ou os filtros para encontrar um cliente.</p>{active && <button className="button secondary" onClick={clear}>Limpar filtros</button>}</div>}
      {pages > 1 && <div className="client-pagination"><button className="button secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage} de {pages}</span><button className="button secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>}
    </section>}
  </div>;
}

export function ClientDetails({ client, data, liveMode, close, notify, onUpdated, onOrder, onNewOrder, onProfileLink }: {
  client: Client; data: { devices: Device[]; orders: Order[] }; liveMode: boolean; close: () => void;
  notify: (message: string, error?: boolean) => void; onUpdated: () => void; onOrder: (order: Order) => void; onNewOrder: (client: Client) => void; onProfileLink: (clientId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => { function escape(event: KeyboardEvent) { if (event.key === 'Escape' && !editing) close(); } window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [close, editing]);
  const orders = clientOrders(data.orders, client.id);
  const devices = data.devices.filter(d => d.clientId === client.id);
  if (editing) return <ClientRegistrationModal client={client} liveMode={liveMode} close={() => setEditing(false)} notify={notify} onCreated={onUpdated} />;
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal client-registration-modal" role="dialog" aria-modal="true" aria-labelledby="client-detail-title"><header><div><span className="eyebrow">Ficha do cliente</span><h2 id="client-detail-title">{client.name}</h2><p>{client.documentType === 'cnpj' ? 'Pessoa jurídica' : 'Pessoa física'}</p></div><button className="icon-button" aria-label="Fechar ficha" onClick={close}><X size={20}/></button></header><div className="modal-body">
    <div className="client-detail-actions"><button className="button primary" onClick={() => setEditing(true)}>Editar cadastro</button>{liveMode && <button className="button secondary" onClick={() => onProfileLink(client.id)}><Link2 size={15} /> Link de atualização</button>}<button className="button secondary" onClick={() => onNewOrder(client)}>Novo atendimento</button></div>
    <dl className="client-detail-fields"><div><dt>Telefone</dt><dd>{client.phone ? <a href={`tel:${client.phone.replace(/[^+\d]/g, '')}`}>{client.phone}</a> : 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : 'Não informado'}</dd></div><div><dt>{client.documentType === 'cnpj' ? 'CNPJ' : 'CPF'}</dt><dd>{client.taxId || 'Não informado'}</dd></div><div><dt>Endereço</dt><dd>{client.address || 'Não informado'}</dd></div>{client.legalName && <div><dt>Razão social</dt><dd>{client.legalName}</dd></div>}{client.tradeName && <div><dt>Nome fantasia</dt><dd>{client.tradeName}</dd></div>}<div><dt>Observações</dt><dd>{client.notes || 'Nenhuma observação'}</dd></div></dl>
    <h3>Equipamentos ({devices.length})</h3>{devices.length ? <ul className="client-history">{devices.map(device => <li key={device.id}><b>{device.code} · {device.brand} {device.model}</b><small>{device.kind} · Série: {device.serial || 'não informada'}</small>{device.notes && <p>{device.notes}</p>}</li>)}</ul> : <p className="muted">Nenhum equipamento cadastrado.</p>}
    <h3>Histórico de atendimentos ({orders.length})</h3>{orders.length ? <ul className="client-history">{orders.map(order => <li key={order.id}><button className="client-name-button" onClick={() => onOrder(order)}><b>{order.number} · {order.status}</b><small>{order.createdAt ? dateLabel(order.createdAt.slice(0,10)) : 'Data não informada'} · {order.mode}</small><span>{order.issue}</span></button></li>)}</ul> : <p className="muted">Este cliente ainda não tem ordens de serviço.</p>}
  </div></section></div>;
}
