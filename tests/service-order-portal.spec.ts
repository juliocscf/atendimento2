import { expect, test } from '@playwright/test';

const invalidToken = 'token-invalido-abcdefghijklmnopqrstuvwxyz0123456789';

test('portal de acompanhamento é público e bloqueia tokens inválidos', async ({ request }) => {
  const page = await request.get(`/acompanhar/${invalidToken}`, { maxRedirects: 0 });
  expect(page.status()).toBe(404);
  expect(page.headers().location).toBeUndefined();
  expect(await page.text()).not.toContain('Bem-vinda de volta');

  const approval = await request.post(`/api/portal/orders/${invalidToken}/approve`, { maxRedirects: 0 });
  expect(approval.status()).toBe(400);
  expect(approval.headers().location).toBeUndefined();

  const pickup = await request.post(`/api/portal/orders/${invalidToken}/pickup-authorization`, {
    maxRedirects: 0,
    data: { action: 'request', authorizedName: 'Pessoa Autorizada', cpf: '52998224725', deliveryChannel: 'whatsapp' },
  });
  expect(pickup.status()).toBe(400);
  expect(pickup.headers().location).toBeUndefined();
});
