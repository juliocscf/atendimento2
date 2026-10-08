import { NextResponse } from 'next/server';
import { type QuoteItemType } from '@/lib/quote-finance';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const serviceOrderId = new URL(request.url).searchParams.get('serviceOrderId');
  let query = supabase.from('quotes').select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, created_at, updated_at').eq('organization_id', membership.organization_id);
  if (serviceOrderId) query = query.eq('service_order_id', serviceOrderId);
  const { data, error } = await query.order(serviceOrderId ? 'version' : 'updated_at', { ascending: false }).limit(serviceOrderId ? 10 : 100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { serviceOrderId?: string; validUntil?: string | null; discountCents?: number; notes?: string; items?: Array<{ description?: string; quantity?: number; unitPriceCents?: number; itemType?: QuoteItemType; unitCostCents?: number | null; serviceId?: string; serviceCode?: string; serviceName?: string; productId?: string }> } | null;
  const serviceOrderId = typeof body?.serviceOrderId === 'string' ? body.serviceOrderId.trim() : '';
  const items = body?.items ?? [];
  if (!Array.isArray(items) || items.some(item => !item || !['part', 'labor', 'unclassified'].includes(item.itemType ?? 'unclassified') || (item.unitCostCents != null && (item.itemType !== 'part' || !Number.isSafeInteger(item.unitCostCents) || item.unitCostCents < 0 || item.unitCostCents > 2147483647)))) return NextResponse.json({ error: 'Informe um tipo válido e um custo de compra válido somente para peças.' }, { status: 400 });
  if (items.some(item => item.productId && (item.itemType !== 'part' || !/^[0-9a-f-]{36}$/i.test(item.productId)))) return NextResponse.json({ error: 'A peça selecionada não é válida.' }, { status: 400 });
  if (!serviceOrderId || !items.length || items.some(item => typeof item.description !== 'string' || item.description.trim().length < 2 || !(item.quantity && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 99999999.99 && Math.abs(item.quantity * 100 - Math.round(item.quantity * 100)) < 0.000001) || !Number.isSafeInteger(item.unitPriceCents) || (item.unitPriceCents ?? 0) > 2147483647 || (item.unitPriceCents ?? 0) < 0)) return NextResponse.json({ error: 'Service order and at least one valid quote item are required.' }, { status: 400 });
  const catalogIds = [...new Set(items.flatMap(item => item.serviceId ? [item.serviceId] : []))];
  if (items.some(item => (item.serviceId && (item.itemType !== 'labor' || !/^[0-9a-f-]{36}$/i.test(item.serviceId) || typeof item.serviceCode !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(item.serviceCode) || typeof item.serviceName !== 'string' || item.serviceName.length < 2 || item.serviceName.length > 120)) || (!item.serviceId && (item.serviceCode || item.serviceName)))) return NextResponse.json({ error: 'Confira o serviço selecionado.' }, { status: 400 });
  if (catalogIds.length) {
    const { data: catalog, error } = await supabase.from('service_catalog').select('id').eq('organization_id', membership.organization_id).in('id', catalogIds);
    if (error || catalog?.length !== catalogIds.length) return NextResponse.json({ error: 'Serviço não encontrado no catálogo da organização.' }, { status: 400 });
  }
  const productIds = [...new Set(items.flatMap(item => item.productId ? [item.productId] : []))];
  if (productIds.length) {
    const { data: products, error: productsError } = await supabase.from('products').select('id, active').eq('organization_id', membership.organization_id).in('id', productIds);
    if (productsError || products?.length !== productIds.length || products.some(product => !product.active)) return NextResponse.json({ error: 'Peça não encontrada ou inativa no cadastro de produtos.' }, { status: 400 });
  }
  const { error: schemaError } = await supabase.from('quote_items').select('item_type, unit_cost_cents').limit(0);
  if (schemaError) return NextResponse.json({ error: /item_type|unit_cost_cents/.test(schemaError.message) ? 'A separação de peças e mão de obra precisa ser ativada no banco de dados.' : 'Não foi possível verificar os itens do orçamento.' }, { status: 503 });
  const { data: order } = await supabase.from('service_orders').select('id').eq('id', serviceOrderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data: previous } = await supabase.from('quotes').select('version').eq('service_order_id', serviceOrderId).eq('organization_id', membership.organization_id).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = (previous?.version ?? 0) + 1;
  const calculatedItems = items.map((item, position) => ({ description: item.description!.trim(), quantity: item.quantity!, unit_price_cents: item.unitPriceCents!, total_cents: Math.round(item.quantity! * item.unitPriceCents!), position, service_catalog_id: item.serviceId || null, service_code: item.serviceId ? item.serviceCode : null, service_name: item.serviceId ? item.serviceName : null, product_id: item.productId || null, item_type: item.itemType ?? 'unclassified', unit_cost_cents: item.itemType === 'part' ? item.unitCostCents ?? null : null }));
  const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.total_cents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 2147483647) return NextResponse.json({ error: 'O total do orçamento excede o limite permitido.' }, { status: 400 });
  const discountCents = Number.isInteger(body?.discountCents) ? Math.min(Math.max(body?.discountCents ?? 0, 0), subtotalCents) : 0;
  const { data: quote, error: quoteError } = await supabase.from('quotes').insert({ organization_id: membership.organization_id, service_order_id: serviceOrderId, version, valid_until: body?.validUntil || null, notes: body?.notes?.trim() || null, subtotal_cents: subtotalCents, discount_cents: discountCents, total_cents: subtotalCents - discountCents, created_by: userId }).select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, created_at').single();
  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 400 });
  const { error: itemsError } = await supabase.from('quote_items').insert(calculatedItems.map(item => ({ ...item, organization_id: membership.organization_id, quote_id: quote.id })));
  if (itemsError) { await supabase.from('quotes').delete().eq('id', quote.id).eq('organization_id', membership.organization_id); return NextResponse.json({ error: /item_type|unit_cost_cents/.test(itemsError.message) ? 'A separação de peças e mão de obra precisa ser ativada no banco de dados. Solicite à administração a atualização do banco de dados.' : itemsError.message }, { status: 400 }); }
  return NextResponse.json({ data: quote }, { status: 201 });
}
