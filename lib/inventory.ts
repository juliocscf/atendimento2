export type Product = { id: string; code: string; name: string; barcode: string; category: string; brand: string; supplier: string; unit: string; cost_cents: number; price_cents: number; minimum_stock: number; active: boolean };
export type StockBalance = { product_id: string; quantity: number; reserved: number };
export type Sale = { id: string; client_id: string | null; status: 'confirmed' | 'returned' | 'cancelled'; total_cents: number; paid_cents: number; note: string; created_at: string };
export type StockPart = { id: string; order_id: string; product_id: string; quantity: number; status: 'reserved' | 'consumed' | 'released' | 'returned' };
export type InventoryData = {
 products: Product[]; balances: StockBalance[]; sales: Sale[];
 movements: { id: string; product_id: string; quantity_delta: number; reserved_delta: number; kind: string; reason: string; created_at: string }[];
 purchases: { id: string; invoice_number: string; supplier_name: string; total_cents: number; created_at: string }[];
 parts: StockPart[]; clients: { id: string; name: string }[];
 units: { id: string; name: string; role: string }[]; unitId: string; role: string;
 summary: { total: number; received: number; pending: number };
};
export const movementLabels: Record<string, string> = { adjust: 'Ajuste', purchase: 'Entrada NF-e', sale: 'Venda', return: 'Devolução', reserve: 'Reserva OS', consume: 'Uso na OS', release: 'Reserva liberada', restock: 'Devolução OS' };
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function cents(value: string) { return Math.round(Number(value.replace(',', '.')) * 100); }
export function quantity(value: string) { return Number(value.replace(',', '.')); }
export function available(data: InventoryData, productId: string) { const balance=data.balances.find(b=>b.product_id===productId); return Number(balance?.quantity??0)-Number(balance?.reserved??0); }
