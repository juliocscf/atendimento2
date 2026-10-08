import type { Status } from '@/lib/demo';
import type { PickupAuthorizationPublic } from '@/lib/pickup-authorization';

export type ServiceOrderPortalEvent = {
  status: Status;
  created_at: string;
};

export type ServiceOrderPortalQuoteItem = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ServiceOrderPortalQuote = {
  status: 'sent' | 'approved';
  version: number;
  valid_until: string | null;
  notes: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  approved_at: string | null;
  items: ServiceOrderPortalQuoteItem[];
};

export type ServiceOrderPortalPartsBlock = {
  active: boolean;
  description?: string | null;
  expected_date?: string | null;
  note?: string | null;
  blocked_at?: string | null;
  received_at?: string | null;
};

export type ServiceOrderPortalPartsEvent = {
  action: 'parts_block' | 'parts_resume' | string | null;
  description: string;
  created_at: string;
};

export type ServiceOrderPortalData = {
  order_number: string;
  organization_name: string;
  unit_name: string;
  client_first_name: string;
  device_label: string;
  issue: string;
  status: Status;
  created_at: string;
  due_date: string | null;
  updated_at: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  parts_block: ServiceOrderPortalPartsBlock | null;
  parts_events: ServiceOrderPortalPartsEvent[];
  events: ServiceOrderPortalEvent[];
  quote: ServiceOrderPortalQuote | null;
  third_party_pickup_available: boolean;
  pickup_authorization: PickupAuthorizationPublic | null;
};

export const publicStatusLabels: Record<Status, string> = {
  Recebido: 'Equipamento recebido',
  Diagnóstico: 'Em diagnóstico',
  'Aguardando aprovação': 'Aguardando sua aprovação',
  'Em execução': 'Serviço em andamento',
  'Em testes': 'Em testes finais',
  'Pronto para entrega': 'Pronto para retirada',
  Concluído: 'Equipamento entregue',
  Cancelada: 'Atendimento cancelado',
  Anulada: 'Atendimento anulado',
};
