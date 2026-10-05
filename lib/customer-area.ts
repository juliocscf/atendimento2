import type { Status } from '@/lib/demo';

export type CustomerOrder = {
  id: string; client_id: string; number: string; status: Status; issue: string; created_at: string;
  due_date: string | null; device_label: string; total_cents: number; paid_cents: number; balance_cents: number;
  events: { status: Status; created_at: string }[];
  quotes: { version: number; status: string; total_cents: number; approved_at: string | null; valid_until: string | null;
    items: { description: string; quantity: number; total_cents: number }[] }[];
  payments: { amount_cents: number; method: string; received_at: string }[];
  pickups: { authorized_name: string; cpf_last4: string; status: string; requested_at: string; collected_at: string | null }[];
};
export type CustomerAreaData = {
  first_name: string; client_id: string; organization_id: string; organization_name: string;
  devices: { id: string; code: string; kind: string; brand: string; model: string }[];
  orders: CustomerOrder[];
  contact_requests: { id: string; channel: string; new_contact: string; status: string; created_at: string }[];
};
