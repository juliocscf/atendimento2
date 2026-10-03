export type CatalogService = { id: string; code: string; name: string; description: string; category: string; default_price_cents: number; is_active: boolean };
export const CATALOG_STORAGE_KEY = 'atendimento-2:service-catalog:v1';
export function serviceInput(body: unknown): Omit<CatalogService, 'id'> | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const category = typeof value.category === 'string' ? value.category.trim() : '';
  if (!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code) || name.length < 2 || name.length > 120 || description.length > 2000 || category.length > 80 || !Number.isInteger(value.default_price_cents) || Number(value.default_price_cents) < 0 || Number(value.default_price_cents) > 2147483647 || typeof value.is_active !== 'boolean') return null;
  return { code, name, description, category, default_price_cents: Number(value.default_price_cents), is_active: value.is_active };
}
