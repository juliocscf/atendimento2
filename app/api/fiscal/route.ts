import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { uuidPattern } from '@/lib/inventory';
import { isNotaasConfigured, notaasRequest, providerError, safeProviderResponse } from '@/lib/notaas';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const paymentCodes: Record<string, string> = { dinheiro: '01', cartao: '03', pix: '17', transferencia: '18', outro: '99' };

async function authorizedUnit(request: Request) {
  const context = await getRequestContext();
  if (!context.userId || !context.membership) return { ...context, unitId: '', member: null, units: [], error: NextResponse.json({ error: 'Faça login para acessar o módulo fiscal.' }, { status: 401 }) };
  const { data: memberships, error } = await context.supabase.from('unit_memberships').select('unit_id, role').eq('organization_id', context.membership.organization_id).eq('user_id', context.userId).eq('is_active', true);
  if (error) return { ...context, unitId: '', member: null, units: [], error: NextResponse.json({ error: 'Não foi possível consultar suas unidades.' }, { status: 500 }) };
  const unitId = new URL(request.url).searchParams.get('unitId') || context.membership.unit_id;
  const member = memberships?.find(item => item.unit_id === unitId) ?? null;
  if (!member) return { ...context, unitId, member: null, units: [], error: NextResponse.json({ error: 'Unidade não autorizada.' }, { status: 403 }) };
  return { ...context, unitId, member, units: memberships ?? [], error: null };
}

export async function GET(request: Request) {
  const context = await authorizedUnit(request);
  if (context.error) return context.error;
  if (!context.membership || !context.member) return NextResponse.json({ error: 'Contexto de acesso inválido.' }, { status: 403 });
  const { supabase, membership, unitId } = context;
  const { data: sales, error: salesError } = await supabase.from('product_sales').select('id, client_id, status, subtotal_cents, discount_cents, total_cents, paid_cents, created_at').eq('organization_id', membership.organization_id).eq('unit_id', unitId).order('created_at', { ascending: false }).limit(60);
  if (salesError) return NextResponse.json({ error: 'Não foi possível consultar as vendas.' }, { status: 500 });
  const saleIds = (sales ?? []).map(item => item.id);
  const clientIds = [...new Set((sales ?? []).map(item => item.client_id).filter(Boolean))] as string[];
  const [{ data: items }, { data: documents }, { data: clients }, { data: units }] = await Promise.all([
    saleIds.length ? supabase.from('product_sale_items').select('sale_id, product_id').eq('organization_id', membership.organization_id).in('sale_id', saleIds) : Promise.resolve({ data: [] as Row[] }),
    saleIds.length ? supabase.from('fiscal_documents').select('id, sale_id, model, status, provider_invoice_id, access_key, number, series, protocol, error_message, created_at, updated_at').eq('organization_id', membership.organization_id).in('sale_id', saleIds) : Promise.resolve({ data: [] as Row[] }),
    clientIds.length ? supabase.from('clients').select('id, full_name').eq('organization_id', membership.organization_id).in('id', clientIds) : Promise.resolve({ data: [] as Row[] }),
    supabase.from('units').select('id, name').eq('organization_id', membership.organization_id).eq('is_active', true),
  ]);
  const productIds = [...new Set((items ?? []).map(item => String(item.product_id)))];
  const { data: products } = productIds.length
    ? await supabase.from('products').select('id, ncm, cfop, csosn, cst').eq('organization_id', membership.organization_id).in('id', productIds)
    : { data: [] as Row[] };
  const productMap = new Map((products ?? []).map(item => [String(item.id), item]));
  const documentMap = new Map((documents ?? []).map(item => [String(item.sale_id), item]));
  const clientMap = new Map((clients ?? []).map(item => [String(item.id), String(item.full_name)]));
  const mappedSales = (sales ?? []).map(sale => {
    const saleItems = (items ?? []).filter(item => item.sale_id === sale.id);
    const missing = new Set<string>();
    if (!saleItems.length) missing.add('itens da venda');
    for (const item of saleItems) {
      const product = productMap.get(String(item.product_id));
      if (!product?.ncm) missing.add('NCM');
      if (!product?.cfop) missing.add('CFOP');
      if (!product?.csosn && !product?.cst) missing.add('CSOSN/CST');
    }
    return {
      id: sale.id,
      client_name: sale.client_id ? clientMap.get(sale.client_id) ?? 'Cliente identificado' : 'Consumidor não identificado',
      status: sale.status,
      total_cents: sale.total_cents,
      paid_cents: sale.paid_cents,
      created_at: sale.created_at,
      ready: sale.status === 'confirmed' && missing.size === 0,
      missing: [...missing],
      item_count: saleItems.length,
      document: documentMap.get(sale.id) ?? null,
    };
  });
  return NextResponse.json({ data: {
    configured: isNotaasConfigured(), unitId, role: context.member.role,
    units: (units ?? []).filter(unit => context.units.some(member => member.unit_id === unit.id)).map(unit => ({ id: unit.id, name: unit.name, role: context.units.find(member => member.unit_id === unit.id)?.role })),
    sales: mappedSales,
  } });
}

export async function POST(request: Request) {
  const context = await authorizedUnit(request);
  if (context.error) return context.error;
  if (!context.membership || !context.member || !context.userId) return NextResponse.json({ error: 'Contexto de acesso inválido.' }, { status: 403 });
  if (!['gestor', 'atendimento'].includes(context.member.role)) return NextResponse.json({ error: 'Seu perfil não pode emitir documentos fiscais.' }, { status: 403 });
  const text = await request.text();
  if (text.length > 20000) return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
  let body: Row;
  try { body = JSON.parse(text) as Row; } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }); }

  if (body.action === 'product') {
    const productId = String(body.productId ?? '');
    const ncm = String(body.ncm ?? '').replace(/\D/g, '');
    const cfop = String(body.cfop ?? '').replace(/\D/g, '');
    const csosn = String(body.csosn ?? '').replace(/\D/g, '');
    const cst = String(body.cst ?? '').replace(/\D/g, '');
    if (!uuidPattern.test(productId) || (ncm && ncm.length !== 8) || (cfop && cfop.length !== 4) || (csosn && csosn.length !== 3) || (cst && cst.length !== 2) || (csosn && cst)) return NextResponse.json({ error: 'Confira NCM, CFOP e o código tributário do produto.' }, { status: 400 });
    const { error } = await context.supabase.from('products').update({ ncm, cfop, csosn, cst }).eq('organization_id', context.membership.organization_id).eq('id', productId);
    if (error) return NextResponse.json({ error: 'Não foi possível salvar os dados fiscais do produto.' }, { status: 400 });
    return NextResponse.json({ data: { id: productId } });
  }

  if (body.action !== 'issue' || !uuidPattern.test(String(body.saleId ?? ''))) return NextResponse.json({ error: 'Operação fiscal inválida.' }, { status: 400 });
  if (!isNotaasConfigured()) return NextResponse.json({ error: 'Configure NOTAAS_API_KEY no ambiente do servidor antes de emitir.' }, { status: 503 });
  const saleId = String(body.saleId);
  const { supabase, membership, unitId, userId } = context;
  const { data: sale } = await supabase.from('product_sales').select('*').eq('organization_id', membership.organization_id).eq('unit_id', unitId).eq('id', saleId).maybeSingle();
  if (!sale || sale.status !== 'confirmed') return NextResponse.json({ error: 'Venda confirmada não encontrada nesta unidade.' }, { status: 404 });
  const { data: existing } = await supabase.from('fiscal_documents').select('id, status').eq('organization_id', membership.organization_id).eq('sale_id', saleId).maybeSingle();
  if (existing && existing.status !== 'error') return NextResponse.json({ error: 'Esta venda já possui um documento fiscal.' }, { status: 409 });

  const [{ data: items }, { data: payments }, { data: client }] = await Promise.all([
    supabase.from('product_sale_items').select('*').eq('organization_id', membership.organization_id).eq('sale_id', saleId),
    supabase.from('product_sale_payments').select('amount_cents, method').eq('organization_id', membership.organization_id).eq('sale_id', saleId).gt('amount_cents', 0),
    sale.client_id ? supabase.from('clients').select('full_name, tax_id, email').eq('organization_id', membership.organization_id).eq('id', sale.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!items?.length) return NextResponse.json({ error: 'A venda não possui itens para emissão.' }, { status: 400 });
  const productIds = [...new Set(items.map(item => item.product_id))];
  const { data: products } = await supabase.from('products').select('id, code, barcode, unit, ncm, cfop, csosn, cst').eq('organization_id', membership.organization_id).in('id', productIds);
  const productMap = new Map((products ?? []).map(item => [item.id, item]));
  const invalid = items.find(item => { const product = productMap.get(item.product_id); return !product?.ncm || !product?.cfop || (!product?.csosn && !product?.cst); });
  if (invalid) return NextResponse.json({ error: `Complete NCM, CFOP e CSOSN/CST de ${invalid.name}.` }, { status: 400 });

  let allocatedDiscount = 0;
  const fiscalItems = items.map((item, index) => {
    const product = productMap.get(item.product_id)!;
    const discount = index === items.length - 1 ? Number(sale.discount_cents) - allocatedDiscount : Math.round(Number(sale.discount_cents) * Number(item.total_cents) / Math.max(1, Number(sale.subtotal_cents)));
    allocatedDiscount += discount;
    return {
      codigo: product.code,
      descricao: item.name,
      ncm: product.ncm,
      cfop: product.cfop,
      unidade: product.unit || 'UN',
      quantidade: Number(item.quantity),
      valorUnitario: Number(item.price_cents) / 100,
      valorTotal: Number(item.total_cents) / 100,
      ...(discount > 0 ? { desconto: discount / 100 } : {}),
      ...(product.barcode ? { ean: product.barcode } : {}),
      ...(product.csosn ? { csosn: product.csosn } : { cst: product.cst }),
    };
  });
  const fiscalPayments = (payments ?? []).map(payment => ({
    tipoPagamento: paymentCodes[payment.method] ?? '99',
    valor: Number(payment.amount_cents) / 100,
    ...(payment.method === 'outro' ? { descricaoPagamento: 'Outro meio de pagamento' } : {}),
  }));
  const pending = Number(sale.total_cents) - (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount_cents), 0);
  if (pending > 0) fiscalPayments.push({ tipoPagamento: '05', valor: pending / 100 });
  const taxId = String(client?.tax_id ?? '').replace(/\D/g, '');
  const payload = {
    modelo: 65,
    naturezaOperacao: 'Venda de mercadoria',
    presencaComprador: 1,
    items: fiscalItems,
    pagamentos: fiscalPayments,
    ...(client && [11, 14].includes(taxId.length) ? { dest: { nome: client.full_name, ...(taxId.length === 11 ? { cpf: taxId } : { cnpj: taxId }), ...(client.email ? { email: client.email } : {}) } } : {}),
  };
  const reset = { status: 'submitting', provider_invoice_id: null, access_key: null, number: null, series: null, protocol: null, error_message: null, provider_response: {}, updated_at: new Date().toISOString() };
  const documentResult = existing
    ? await supabase.from('fiscal_documents').update(reset).eq('organization_id', membership.organization_id).eq('id', existing.id).select('id').single()
    : await supabase.from('fiscal_documents').insert({ organization_id: membership.organization_id, unit_id: unitId, sale_id: saleId, model: 65, status: 'submitting', created_by: userId }).select('id').single();
  const document = documentResult.data;
  if (documentResult.error || !document) return NextResponse.json({ error: documentResult.error?.code === '23505' ? 'Esta venda já possui um documento fiscal.' : 'Não foi possível iniciar a emissão fiscal.' }, { status: 409 });
  try {
    const result = await notaasRequest('/nfe/emitir', { method: 'POST', body: JSON.stringify(payload) });
    const invoiceId = String(result.data.invoiceId ?? result.data.id ?? '');
    if (!result.ok || !invoiceId) {
      const message = providerError(result.data, `Notaas recusou a emissão (${result.status}).`);
      await supabase.from('fiscal_documents').update({ status: 'error', error_message: message, provider_response: safeProviderResponse(result.data), updated_at: new Date().toISOString() }).eq('id', document.id);
      return NextResponse.json({ error: message }, { status: 422 });
    }
    await supabase.from('fiscal_documents').update({ status: 'queued', provider_invoice_id: invoiceId, error_message: null, provider_response: safeProviderResponse(result.data), updated_at: new Date().toISOString() }).eq('id', document.id);
    return NextResponse.json({ data: { id: document.id, status: 'queued' } }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível conectar ao Notaas.';
    await supabase.from('fiscal_documents').update({ status: 'error', error_message: message, updated_at: new Date().toISOString() }).eq('id', document.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
