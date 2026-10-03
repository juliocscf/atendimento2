import { expect, test } from '@playwright/test';
import { CATALOG_STORAGE_KEY, serviceInput } from '../lib/service-catalog';

test('valida códigos e preços do catálogo', () => {
  expect(serviceInput({ code: ' srv-001 ', name: ' Limpeza ', default_price_cents: 15000, is_active: true })).toMatchObject({ code: 'SRV-001', name: 'Limpeza', default_price_cents: 15000 });
  for (const code of ['', 'COD INVÁLIDO', 'x'.repeat(31)]) expect(serviceInput({ code, name: 'Limpeza', default_price_cents: 100, is_active: true })).toBeNull();
  expect(serviceInput({ code: 'SRV-001', name: 'Limpeza', default_price_cents: -1, is_active: true })).toBeNull();
});
test('cadastra, pesquisa, preserva após recarregar e inativa serviço', async ({ page }) => {
  await page.goto('/servicos');
  await page.getByRole('button', { name: 'Cadastrar serviço', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Código', { exact: true }).fill('srv-001');
  await dialog.getByLabel('Nome do serviço').fill('Limpeza preventiva');
  await dialog.getByLabel('Preço padrão').fill('150,00');
  await dialog.getByLabel('Descrição padrão').fill('Limpeza interna e teste de temperatura');
  await dialog.getByRole('button', { name: 'Salvar serviço' }).click();
  await expect(page.locator('.service-catalog-list')).toContainText('SRV-001 · Limpeza preventiva');
  await page.reload();
  await page.getByLabel('Pesquisar código ou nome').fill('srv-001');
  await page.getByRole('button', { name: 'Editar SRV-001' }).click();
  await dialog.getByLabel('Situação').selectOption('inactive');
  await dialog.getByRole('button', { name: 'Salvar serviço' }).click();
  await page.getByLabel('Situação').selectOption('active');
  await expect(page.locator('.service-catalog-list article')).toHaveCount(0);
});
test('serviço preenche mão de obra e permite preço específico sem mudar catálogo', async ({ page }) => {
  await page.goto('/servicos');
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify([
    { id: '00000000-0000-4000-8000-000000000001', code: 'SRV-001', name: 'Limpeza', description: 'Limpeza interna', category: 'Manutenção', default_price_cents: 15000, is_active: true },
    { id: '00000000-0000-4000-8000-000000000002', code: 'SRV-002', name: 'Desativado', description: '', category: '', default_price_cents: 1000, is_active: false },
  ])), CATALOG_STORAGE_KEY);
  await page.goto('/orcamentos');
  await page.getByRole('button', { name: 'Novo orçamento', exact: true }).click();
  const item = page.getByRole('group', { name: 'Item 1', exact: true });
  await item.getByLabel('Buscar serviço por código ou nome').fill('srv-001');
  await item.getByRole('button', { name: /SRV-001 · Limpeza/ }).click();
  await expect(item.getByLabel('Descrição do serviço ou peça')).toHaveValue('Limpeza — Limpeza interna');
  await expect(item.getByLabel('Valor unitário')).toHaveValue('150,00');
  await item.getByLabel('Valor unitário').fill('125,00');
  await expect(item.locator('.service-selected')).toContainText('SRV-001');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0].default_price_cents, CATALOG_STORAGE_KEY)).toBe(15000);
  await item.getByLabel('Buscar serviço por código ou nome').fill('SRV-002');
  await expect(item.getByRole('button', { name: /SRV-002/ })).toHaveCount(0);
  await item.getByLabel('Tipo do item').selectOption('part');
  await expect(item.locator('.service-selected')).toHaveCount(0);
  await expect(item.getByLabel('Buscar serviço por código ou nome')).toHaveCount(0);
});
