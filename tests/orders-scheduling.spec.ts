import { expect, test } from '@playwright/test';

test('agenda opcional, persistência e bloqueio de horários ocupados', async ({ page }) => {
  await page.goto('/ordens');
  await page.getByRole('button', { name: 'Novo atendimento' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Agendar atendimento agora')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Defeito relatado' }).fill('Notebook não liga após atualização');
  await dialog.getByRole('checkbox', { name: 'Agendar atendimento agora' }).check();
  const target = new Date();
  target.setDate(target.getDate() + 15);
  const day = target.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  await dialog.getByLabel('Data', { exact: true }).fill(day);
  await dialog.getByLabel('Horário', { exact: true }).fill('10:30');
  await dialog.getByRole('button', { name: 'Criar e agendar' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').getByText(/criada e agendada/)).toBeVisible();

  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await page.getByLabel('Escolher data da agenda').fill(day);
  await expect(page.getByRole('button', { name: /10:30 · Atendimento no balcão/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await page.getByLabel('Escolher data da agenda').fill(day);
  await expect(page.getByRole('button', { name: /10:30 · Atendimento no balcão/ })).toBeVisible();

  await page.goto('/ordens');
  await page.getByRole('button', { name: 'Novo atendimento' }).first().click();
  const second = page.getByRole('dialog');
  await second.getByRole('textbox', { name: 'Defeito relatado' }).fill('Outro equipamento não liga');
  await second.getByRole('checkbox', { name: 'Agendar atendimento agora' }).check();
  await second.getByLabel('Data', { exact: true }).fill(day);
  await second.getByLabel('Horário', { exact: true }).fill('10:45');
  await second.getByRole('button', { name: 'Criar e agendar' }).click();
  await expect(page.getByRole('alert').getByText(/horário já está ocupado/)).toBeVisible();
  await expect(second).toBeVisible();
});

test('a ficha explica a aprovação antes de liberar a execução', async ({ page }) => {
  await page.goto('/ordens');
  await page.getByRole('row').filter({ hasText: 'OS-2026-1250' }).click();
  await expect(page.getByRole('region', { name: 'Etapas do atendimento' })).toContainText('Aguardar a decisão do cliente');
  await expect(page.getByRole('region', { name: 'Próximo passo da ordem de serviço' })).toContainText('aprovação reais');
  await expect(page.getByRole('button', { name: 'Avançar para Em execução' })).toHaveCount(0);
});

test('permite voltar uma etapa, justificar e editar a solicitação', async ({ page }) => {
  await page.goto('/ordens');
  await page.getByRole('row').filter({ hasText: 'OS-2026-1250' }).click();
  const drawer = page.locator('.order-drawer');
  await drawer.getByRole('button', { name: 'Voltar para Diagnóstico' }).click();
  await drawer.getByRole('button', { name: 'Confirmar retorno' }).click();
  await expect(page.getByRole('alert').getByText(/motivo da volta/)).toBeVisible();
  await drawer.getByLabel('Motivo da correção').fill('Corrigir dados do diagnóstico');
  await drawer.getByRole('button', { name: 'Confirmar retorno' }).click();
  await page.getByRole('row').filter({ hasText: 'OS-2026-1250' }).click();
  await expect(page.locator('.order-drawer')).toContainText('Diagnóstico');
  await page.locator('.order-drawer').getByRole('button', { name: 'Editar solicitação' }).click();
  await page.locator('.order-drawer').getByLabel('Problema relatado').fill('Fonte não liga após queda de energia');
  await page.locator('.order-drawer').getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByRole('row').filter({ hasText: 'OS-2026-1250' }).click();
  await expect(page.locator('.order-drawer')).toContainText('Fonte não liga após queda de energia');
});

test('orçamento discrimina vários itens e mostra o total a aprovar', async ({ page }) => {
  await page.goto('/orcamentos');
  await page.getByRole('button', { name: 'Novo orçamento' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Item 1' }).getByLabel('Descrição do serviço ou peça').fill('Troca da fonte');
  await dialog.getByRole('group', { name: 'Item 1' }).getByLabel('Valor unitário (R$)').fill('150,00');
  await dialog.getByRole('button', { name: 'Adicionar item' }).click();
  await dialog.getByRole('group', { name: 'Item 2' }).getByLabel('Descrição do serviço ou peça').fill('Mão de obra');
  await dialog.getByRole('group', { name: 'Item 2' }).getByLabel('Valor unitário (R$)').fill('100,00');
  await expect(dialog.locator('.quote-total-preview strong')).toContainText('R$ 250,00');
  await expect(dialog.getByText('O cliente verá a solicitação, o equipamento, cada item e valor, o desconto, o total, a validade e as condições.')).toBeVisible();
});
