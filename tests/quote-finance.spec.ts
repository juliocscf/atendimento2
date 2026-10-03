import { expect, test } from '@playwright/test';
import { financialBreakdown, unclassifiedBreakdown } from '../lib/quote-finance';

const mixed = [
  { item_type: 'part' as const, quantity: 2, total_cents: 30000, unit_cost_cents: 10000 },
  { item_type: 'labor' as const, quantity: 1, total_cents: 20000 },
];
test('desconto proporcional mantém peças, mão de obra e margem conciliadas', () => {
  const result = financialBreakdown(mixed, 5000);
  expect(result).toMatchObject({ partsCents: 27000, laborCents: 18000, partsCostCents: 20000, partsMarginCents: 7000, totalCents: 45000, category: 'Peças com mão de obra' });
});
test('arredondamento concilia centavos, inclusive itens históricos e desconto total', () => {
  const items = [...mixed, { quantity: 1, total_cents: 10000 }];
  for (const discount of [0, 1, 7, 9999, 60000, 90000]) {
    const r = financialBreakdown(items, discount);
    expect(r.partsCents + r.laborCents + r.unclassifiedCents).toBe(r.totalCents);
    expect(r.partsDiscountCents + r.laborDiscountCents + r.unclassifiedDiscountCents).toBe(Math.min(discount, 60000));
  }
  expect(financialBreakdown(items).category).toBe('Classificação pendente');
  expect(unclassifiedBreakdown(50000).unclassifiedCents).toBe(50000);
});
test('custo ausente não vira margem fictícia e custo zero é válido', () => {
  expect(financialBreakdown([{ item_type: 'part', quantity: 1, total_cents: 10000 }]).partsMarginCents).toBeNull();
  expect(financialBreakdown([{ item_type: 'part', quantity: 1, total_cents: 10000, unit_cost_cents: 0 }]).partsMarginCents).toBe(10000);
  expect(financialBreakdown([{ item_type: 'labor', quantity: 1, total_cents: 10000 }]).category).toBe('Somente mão de obra');
});
test('orçamento separa peças, custo interno e mão de obra na prévia', async ({ page }) => {
  await page.goto('/orcamentos');
  await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const part = dialog.getByRole('group', { name: 'Item 1', exact: true });
  await part.getByLabel('Tipo do item').selectOption('part');
  await part.getByLabel('Descrição do serviço ou peça').fill('Fonte 500 W');
  await part.getByLabel('Quantidade').fill('2');
  await part.getByLabel('Valor unitário').fill('150,00');
  await part.getByLabel('Custo de compra unitário').fill('100,00');
  await dialog.getByRole('button', { name: 'Adicionar item' }).click();
  const labor = dialog.getByRole('group', { name: 'Item 2', exact: true });
  await labor.getByLabel('Descrição do serviço ou peça').fill('Instalação e testes');
  await labor.getByLabel('Valor unitário').fill('200,00');
  await expect(labor.getByLabel('Custo de compra unitário')).toHaveCount(0);
  await dialog.getByLabel('Desconto (R$)').fill('50,00');
  const summary = dialog.getByLabel('Composição interna do valor');
  await expect(summary).toContainText('Peças com mão de obra');
  await expect(summary).toContainText(/270,00/);
  await expect(summary).toContainText(/180,00/);
  await expect(summary).toContainText(/70,00/);
  await expect(dialog.locator('.quote-total-preview')).toContainText(/450,00/);
});
test('financeiro preserva histórico sem classificação e funciona no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/financeiro');
  const report = page.locator('.finance-breakdown-report');
  await expect(report.getByRole('heading', { name: 'Peças e mão de obra' })).toBeVisible();
  await report.getByLabel('Tipo de atendimento').selectOption('Classificação pendente');
  await expect(report.locator('.finance-report-mobile button').first()).toBeVisible();
  await report.getByLabel('Tipo de atendimento').selectOption('Somente peças');
  await expect(report).toContainText('Nenhum atendimento encontrado');
});
