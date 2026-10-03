export const DEMO_DATE = '2026-09-28';
export const STORAGE_KEY = 'atendimento-2:prototype:v1';
export const statuses = ['Recebido', 'Diagnóstico', 'Aguardando aprovação', 'Em execução', 'Em testes', 'Pronto para entrega', 'Concluído'] as const;
export type Status = typeof statuses[number];
export type Mode = 'Balcão' | 'Remoto' | 'Domicílio';
export type View = 'painel' | 'ordens' | 'clientes' | 'equipamentos' | 'agenda' | 'orcamentos' | 'servicos' | 'financeiro' | 'configuracoes';
export type Client = { id: string; name: string; phone: string; email: string; address: string; taxId?: string; documentType?: 'cpf' | 'cnpj'; legalName?: string; tradeName?: string; notes?: string; addressFields?: { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string } };
export type Device = { id: string; clientId: string; code: string; brand: string; model: string; serial: string; kind: string; notes: string };
export type Order = { financialBreakdown?: import('./quote-finance').FinancialBreakdown; createdAt?: string; id: string; number: string; clientId: string; deviceId: string; mode: Mode; status: Status; priority: string; technician: string; issue: string; due: string; amount: number; paid: number; accessories: string; history: { text: string; at: string }[]; contacts: { channel: string; text: string; at: string }[] };
export type Appointment = { id: string; orderId: string; date: string; time: string; duration: number; technician: string; title: string; mode: Mode; address: string };
export type DemoData = { version: 1; clients: Client[]; devices: Device[]; orders: Order[]; appointments: Appointment[] };
export const technicians = ['Rafael Costa', 'Camila Santos', 'Diego Martins'];
const names = ['Ana Carolina de Oliveira', 'Lucas Ferreira', 'Marcos Vinícius Souza', 'Beatriz Almeida', 'Pedro Henrique Lima', 'Escritório Horizonte Arquitetura', 'Fernanda Ribeiro', 'Roberto Mendes', 'Juliana Castro'];
const equipment = [['Dell', 'Inspiron 15 3511', 'A7K9'], ['Lenovo', 'IdeaPad 3', 'B4M2'], ['Montado', 'Desktop Ryzen 5', 'C8P3'], ['Apple', 'MacBook Air M1', 'D5R7'], ['Samsung', 'Book E30', 'E9T4'], ['TP-Link', 'Rede do escritório', 'F3W8'], ['Asus', 'VivoBook 15', 'G6X2'], ['Dell', 'Latitude 5420', 'H2Y5'], ['Acer', 'Aspire 5', 'J4Z6']];
const seedStatuses: Status[] = ['Diagnóstico', 'Aguardando aprovação', 'Em execução', 'Pronto para entrega', 'Recebido', 'Diagnóstico', 'Em testes', 'Aguardando aprovação', 'Concluído'];
const issues = ['Notebook não liga. Cliente relata que desligou durante o uso. Verificar alimentação e placa principal.', 'Lentidão ao iniciar e abrir programas. Avaliar substituição do HD por SSD.', 'Computador reinicia durante o uso. Verificar temperatura e fonte de alimentação.', 'Substituição de bateria e limpeza preventiva concluídas.', 'Configuração de e-mail e organização dos arquivos. Atendimento com autorização do cliente.', 'Rede sem acesso à internet em duas estações. Avaliação no endereço do cliente.', 'Tela apresenta linhas horizontais. Testar novo conjunto de tela.', 'Teclado com teclas sem resposta. Orçamento de substituição enviado.', 'Manutenção preventiva e atualização do sistema concluídas.'];
export const initialData: DemoData = {
  version: 1,
  clients: names.map((name, i) => ({ id: `c${i}`, name, phone: `(11) 90000-${String(1000 + i)}`, email: `cliente${i + 1}@example.com`, address: i === 5 ? 'Rua das Acácias, 240 · Centro' : 'Av. Central, 120 · Centro' })),
  devices: equipment.map(([brand, model, code], i) => ({ id: `d${i}`, clientId: `c${i}`, code, brand, model, serial: `DEMO-${1000 + i}`, kind: i === 2 ? 'Desktop' : i === 5 ? 'Rede / outros' : 'Notebook', notes: i === 0 ? 'Pequena marca na tampa. Carregador original recebido.' : 'Cadastro ilustrativo para navegação.' })),
  orders: names.map((_, i) => ({ id: `o${i}`, number: `OS-2026-${1249 + i}`, clientId: `c${i}`, deviceId: `d${i}`, mode: i === 4 ? 'Remoto' : i === 5 ? 'Domicílio' : 'Balcão', status: seedStatuses[i], priority: i === 0 || i === 5 ? 'Alta' : 'Normal', technician: technicians[i % 3], issue: issues[i], due: i === 0 ? '2026-09-26' : i === 8 ? '2026-09-25' : `2026-09-${28 + i % 3}`, amount: [35000, 48000, 26000, 69000, 12000, 25000, 52000, 32000, 18000][i], paid: i === 3 ? 30000 : i === 8 ? 18000 : 0, accessories: 'Carregador', history: [{ text: 'Atendimento aberto na unidade Matriz · Centro.', at: '25/09/2026, 09:30' }, ...(i > 0 ? [{ text: `Etapa atual: ${seedStatuses[i]}.`, at: '28/09/2026, 08:45' }] : [])], contacts: i === 1 ? [{ channel: 'Telefone', text: 'Cliente recebeu o orçamento e irá avaliar a proposta.', at: '28/09/2026, 09:15' }] : [] })),
  appointments: [
    { id: 'a0', orderId: 'o4', date: DEMO_DATE, time: '09:00', duration: 60, technician: 'Camila Santos', title: 'Configuração de e-mail', mode: 'Remoto', address: '' },
    { id: 'a1', orderId: 'o5', date: DEMO_DATE, time: '11:00', duration: 90, technician: 'Diego Martins', title: 'Diagnóstico de rede', mode: 'Domicílio', address: 'Rua das Acácias, 240 · Centro' },
    { id: 'a2', orderId: 'o3', date: DEMO_DATE, time: '15:30', duration: 30, technician: 'Rafael Costa', title: 'Retirada do MacBook', mode: 'Balcão', address: 'Matriz · Centro' },
    { id: 'a3', orderId: 'o6', date: '2026-09-29', time: '10:00', duration: 60, technician: 'Rafael Costa', title: 'Testes e revisão final', mode: 'Balcão', address: 'Matriz · Centro' },
  ],
};
export function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
export function dateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); }
export function nowLabel() { return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }); }
export function initials(name: string) { return name.split(' ').slice(0, 2).map(n => n[0]).join(''); }
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function isLate(order: Order) { return order.status !== 'Concluído' && order.due < DEMO_DATE; }
export function nextStatus(order: Order): Status | undefined { const index = statuses.indexOf(order.status); return order.status === 'Em testes' && order.mode !== 'Balcão' ? 'Concluído' : statuses[index + 1]; }
export function minutes(time: string) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
export function hasConflict(appointments: Appointment[], candidate: Appointment) { return appointments.some(a => a.id !== candidate.id && a.date === candidate.date && a.technician === candidate.technician && minutes(candidate.time) < minutes(a.time) + a.duration && minutes(a.time) < minutes(candidate.time) + candidate.duration); }
export function newCode(devices: Device[]) { const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; for (let attempt = 0; attempt < 100; attempt++) { const bytes = crypto.getRandomValues(new Uint8Array(4)); const code = Array.from(bytes, b => alphabet[b % 32]).join(''); if (!devices.some(d => d.code === code)) return code; } throw new Error('Não foi possível gerar um código. Tente novamente.'); }
