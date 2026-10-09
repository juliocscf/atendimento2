import { NextResponse } from 'next/server';
import { isFinanciallyValid, orderBalance, orderFinancialSnapshot, summarizeOrderFinance } from '@/lib/order-finance';
import { getRequestContext } from '@/lib/supabase/request-context';

type SupabaseClient = Awaited<ReturnType<typeof getRequestContext>>['supabase'];

export const dynamic = 'force-dynamic';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const closedStatuses = new Set(['Concluído', 'Cancelada', 'Anulada']);
const money = (value: unknown) => Number(value ?? 0) || 0;
const daysBetween = (start: string, end: string) => Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 86400000);

function dateRange(request: Request) {
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const fallbackUntil = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const fallbackFrom = new Date(now.getTime() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const from = params.get('from') || fallbackFrom;
  const until = params.get('until') || fallbackUntil;
  if (!datePattern.test(from) || !datePattern.test(until) || from > until) throw new Error('Informe um período válido.');
  const fromIso = new Date(`${from}T00:00:00-03:00`).toISOString();
  const untilDate = new Date(`${until}T00:00:00-03:00`);
  untilDate.setUTCDate(untilDate.getUTCDate() + 1);
  return { from, until, fromIso, untilIso: untilDate.toISOString() };
}

async function queryRows(supabase: SupabaseClient, table: string, organizationId: string, unitId: string, fromIso?: string, untilIso?: string) {
  let query = supabase.from(table).select('*').eq('organization_id', organizationId).eq('unit_id', unitId);
  if (fromIso) query = query.gte('created_at', fromIso);
  if (untilIso) query = query.lt('created_at', untilIso);
  const result = await query.limit(10000);
  if (result.error) throw new Error(`Não foi possível consultar ${table}.`);
  return result.data as Record<string, unknown>[];
}

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Faça login para consultar os relatórios.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Configure sua organização.' }, { status: 409 });

  try {
    const range = dateRange(request);
    const params = new URL(request.url).searchParams;
    const memberships = await supabase.from('unit_memberships').select('unit_id, role').eq('organization_id', membership.organization_id).eq('user_id', userId).eq('is_active', true);
    if (memberships.error) throw new Error('Não foi possível consultar suas unidades.');
    const unitId = params.get('unitId') || membership.unit_id;
    const currentMembership = memberships.data?.find(item => item.unit_id === unitId);
    if (!currentMembership) return NextResponse.json({ error: 'Unidade não autorizada.' }, { status: 403 });
    const unitsResult = await supabase.from('units').select('id, name').eq('organization_id', membership.organization_id).in('id', memberships.data?.map(item => item.unit_id) ?? []);
    if (unitsResult.error) throw new Error('Não foi possível consultar as unidades.');
    const unitNames = new Map((unitsResult.data ?? []).map(unit => [unit.id, unit.name]));

    const ordersResult = await supabase.from('service_orders')
      .select('id, number, status, amount_cents, paid_cents, due_date, created_at, updated_at, client_id, quotes(version, status, total_cents, discount_cents, quote_items(*))')
      .eq('organization_id', membership.organization_id)
      .eq('unit_id', unitId)
      .gte('created_at', range.fromIso)
      .lt('created_at', range.untilIso)
      .order('created_at', { ascending: false })
      .limit(10000);
    if (ordersResult.error) throw new Error('Não foi possível consultar as ordens de serviço.');
    const orders = (ordersResult.data ?? []).map(order => ({ ...order, ...orderFinancialSnapshot(order) }));
    const orderIds = orders.map(order => order.id);

    const [quotesResult, balances, products, movements, orderParts] = await Promise.all([
      orderIds.length
        ? supabase.from('quotes').select('id, service_order_id, version, status, total_cents, created_at, updated_at').eq('organization_id', membership.organization_id).in('service_order_id', orderIds).limit(10000)
        : Promise.resolve({ data: [], error: null }),
      queryRows(supabase, 'stock_balances', membership.organization_id, unitId),
      supabase.from('products').select('id, code, name, cost_cents, minimum_stock, active').eq('organization_id', membership.organization_id).eq('active', true).limit(10000),
      queryRows(supabase, 'stock_movements', membership.organization_id, unitId, range.fromIso, range.untilIso),
      queryRows(supabase, 'order_stock_items', membership.organization_id, unitId),
    ]);
    if (quotesResult.error || products.error) throw new Error('Não foi possível consultar os dados dos relatórios.');
    const validIds = new Set(orders.filter(order => isFinanciallyValid(order.status)).map(order => order.id));
    const quotes = (quotesResult.data ?? []).filter(quote => validIds.has(quote.service_order_id))
      .sort((a, b) => b.version - a.version)
      .filter((quote, index, all) => all.findIndex(item => item.service_order_id === quote.service_order_id) === index);
    const productRows = products.data ?? [];
    const productById = new Map(productRows.map(product => [product.id, product]));
    const orderById = new Map(orders.map(order => [order.id, order]));

    const totalOrders = orders.length;
    const openOrders = orders.filter(order => !closedStatuses.has(order.status));
    const completedOrders = orders.filter(order => order.status === 'Concluído');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const overdueOrders = openOrders.filter(order => order.due_date && order.due_date < today);
    const finance = summarizeOrderFinance(orders.map(order => ({ status: order.status, amount: money(order.amount_cents), paid: money(order.paid_cents) })));
    const orderRevenue = finance.amount;
    const orderReceived = finance.received;
    const canViewFinance = ['gestor', 'atendimento', 'financeiro'].includes(currentMembership.role);
    const completionDays = completedOrders
      .filter(order => order.created_at && order.updated_at)
      .map(order => daysBetween(order.created_at, order.updated_at));
    const averageCompletionDays = completionDays.length ? completionDays.reduce((sum, value) => sum + value, 0) / completionDays.length : 0;

    const statusCounts = [...new Set(orders.map(order => order.status))].map(status => ({ label: status, count: orders.filter(order => order.status === status).length })).sort((a, b) => b.count - a.count);
    const quoteCounts = ['sent', 'approved', 'rejected', 'expired'].map(status => ({ status, count: quotes.filter(quote => quote.status === status).length }));
    const approvedQuotes = quotes.filter(quote => quote.status === 'approved');
    const quoteApprovalRate = quotes.filter(quote => ['approved', 'rejected', 'expired'].includes(quote.status)).length
      ? approvedQuotes.length / quotes.filter(quote => ['approved', 'rejected', 'expired'].includes(quote.status)).length
      : 0;

    const breakdowns = orders.filter(order => isFinanciallyValid(order.status)).map(order => order.financialBreakdown);
    const partsRevenue = breakdowns.reduce((sum, item) => sum + item.partsCents, 0);
    const partsCost = breakdowns.reduce((sum, item) => sum + item.partsCostCents, 0);
    const missingPartsCost = breakdowns.some(item => item.partsMarginCents == null);

    const balancesByProduct = new Map(balances.map(balance => [balance.product_id, balance]));
    const lowStock = productRows.map(product => {
      const balance = balancesByProduct.get(product.id);
      const physical = money(balance?.quantity);
      const reserved = money(balance?.reserved);
      return { id: product.id, code: product.code, name: product.name, physical, reserved, available: Math.max(0, physical - reserved), minimum: money(product.minimum_stock), costCents: money(product.cost_cents) };
    }).filter(product => product.available <= product.minimum);
    const stockPhysical = [...balancesByProduct.values()].reduce((sum, balance) => sum + money(balance.quantity), 0);
    const stockReserved = [...balancesByProduct.values()].reduce((sum, balance) => sum + money(balance.reserved), 0);
    const stockValue = productRows.reduce((sum, product) => sum + money(balancesByProduct.get(product.id)?.quantity) * money(product.cost_cents), 0);
    const consumedByProduct = new Map<string, number>();
    for (const movement of movements) {
      if (!['consume', 'sale', 'restock', 'return'].includes(String(movement.kind))) continue;
      const quantity = -money(movement.quantity_delta);
      consumedByProduct.set(String(movement.product_id), (consumedByProduct.get(String(movement.product_id)) ?? 0) + quantity);
    }
    const topConsumed = [...consumedByProduct.entries()].filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ ...productById.get(id), id, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const activeReservations = orderParts.filter(part => part.status === 'reserved');
    const staleReservations = activeReservations.filter(part => closedStatuses.has(orderById.get(part.order_id)?.status));
    const oldQuotes = quotes.filter(quote => quote.status === 'sent' && daysBetween(quote.updated_at, new Date().toISOString()) >= 2);

    const alerts: Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string; action: string; actionLabel: string }> = [];
    if (overdueOrders.length) alerts.push({ severity: 'critical', title: `${overdueOrders.length} OS atrasada${overdueOrders.length === 1 ? '' : 's'}`, detail: overdueOrders.slice(0, 3).map(order => order.number).join(', '), action: 'ordens', actionLabel: 'Ver ordens' });
    if (oldQuotes.length) alerts.push({ severity: 'warning', title: `${oldQuotes.length} orçamento${oldQuotes.length === 1 ? '' : 's'} aguardando resposta`, detail: 'Há propostas enviadas há pelo menos 48 horas.', action: 'orcamentos', actionLabel: 'Ver orçamentos' });
    if (lowStock.length) alerts.push({ severity: 'warning', title: `${lowStock.length} produto${lowStock.length === 1 ? '' : 's'} no mínimo`, detail: lowStock.slice(0, 3).map(product => product.name).join(', '), action: 'produtos', actionLabel: 'Ver estoque' });
    if (staleReservations.length) alerts.push({ severity: 'warning', title: `${staleReservations.length} reserva${staleReservations.length === 1 ? '' : 's'} em OS encerrada`, detail: 'Confira as peças para evitar estoque preso.', action: 'produtos', actionLabel: 'Conferir peças' });
    if (canViewFinance && finance.balance > 0) alerts.push({ severity: 'info', title: 'Há valores em aberto', detail: `Saldo no período: R$ ${(finance.balance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, action: 'financeiro', actionLabel: 'Ver financeiro' });

    if (canViewFinance && finance.excludedReceived > 0) alerts.push({ severity: 'warning', title: 'Recebimentos de OS canceladas ou anuladas', detail: 'Há valores registrados nessas OS. Confira a destinação ou devolução no Financeiro.', action: 'financeiro', actionLabel: 'Conferir recebimentos' });
    return NextResponse.json({
      data: {
        range: { from: range.from, until: range.until },
        unitId,
        role: currentMembership.role,
        units: memberships.data?.map(unit => ({ id: unit.unit_id, name: unitNames.get(unit.unit_id) ?? 'Unidade', role: unit.role })) ?? [],
        canViewFinance,
        kpis: {
          totalOrders,
          openOrders: openOrders.length,
          completedOrders: completedOrders.length,
          overdueOrders: overdueOrders.length,
          revenueCents: canViewFinance ? orderRevenue : null,
          receivedCents: canViewFinance ? orderReceived : null,
          openBalanceCents: canViewFinance ? finance.balance : null,
          excludedReceivedCents: canViewFinance ? finance.excludedReceived : null,
          averageCompletionDays,
          quoteApprovalRate,
          approvedQuotes: approvedQuotes.length,
          sentQuotes: quotes.filter(quote => quote.status === 'sent').length,
          partsRevenueCents: canViewFinance ? partsRevenue : null,
          partsCostCents: canViewFinance ? partsCost : null,
          partsMarginCents: canViewFinance && !missingPartsCost ? partsRevenue - partsCost : null,
          stockPhysical,
          stockReserved,
          stockAvailable: Math.max(0, stockPhysical - stockReserved),
          stockValueCents: canViewFinance ? stockValue : null,
          lowStockCount: lowStock.length,
        },
        statuses: statusCounts,
        quotes: quoteCounts,
        lowStock: lowStock.slice(0, 8).map(item => ({ ...item, costCents: canViewFinance ? item.costCents : null })),
        topConsumed,
        alerts,
        recentOrders: orders.slice(0, 8).map(order => ({ id: order.id, number: order.number, status: order.status, amountCents: canViewFinance ? money(order.amount_cents) : null, balanceCents: canViewFinance ? orderBalance({ status: order.status, amount: money(order.amount_cents), paid: money(order.paid_cents) }) : null })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar os relatórios.' }, { status: 400 });
  }
}
