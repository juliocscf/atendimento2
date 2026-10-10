export type FiscalStatus = 'submitting' | 'queued' | 'processing' | 'issued' | 'error' | 'cancel_pending' | 'cancelled' | 'inutilized';

export type FiscalDocument = {
  id: string;
  sale_id: string;
  model: 55 | 65;
  status: FiscalStatus;
  provider_invoice_id: string | null;
  access_key: string | null;
  number: string | null;
  series: string | null;
  protocol: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalSale = {
  id: string;
  client_name: string;
  status: 'confirmed' | 'returned' | 'cancelled';
  total_cents: number;
  paid_cents: number;
  created_at: string;
  ready: boolean;
  missing: string[];
  item_count: number;
  document: FiscalDocument | null;
};

export type FiscalData = {
  configured: boolean;
  unitId: string;
  role: string;
  units: { id: string; name: string; role: string }[];
  sales: FiscalSale[];
};

export const fiscalStatusLabels: Record<FiscalStatus, string> = {
  submitting: 'Enviando', queued: 'Na fila', processing: 'Processando', issued: 'Autorizada',
  error: 'Com erro', cancel_pending: 'Cancelando', cancelled: 'Cancelada', inutilized: 'Inutilizada',
};
