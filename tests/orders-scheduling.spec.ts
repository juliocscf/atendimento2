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
  await page.getByLabel('Escolher data da agenda').fill(day);
  await expect(page.getByRole('button', { name: /10:30 · Atendimento no balcão/ })).toBeVisible();
  await page.reload();
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
