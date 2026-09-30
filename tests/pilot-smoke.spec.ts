import { expect, test } from '@playwright/test';

test('exibe o login e mantém as rotas operacionais protegidas', async ({ request }) => {
  const login = await request.get('/login');
  expect(login.status()).toBe(200);
  const loginHtml = await login.text();
  expect(loginHtml).toContain('Bem-vinda de volta');
  expect(loginHtml).toContain('Entrar');

  const health = await request.get('/api/health/operational');
  expect(health.status()).toBe(200);
  const healthPayload = await health.json() as { configured?: boolean; reachable?: boolean; readOnlyProbe?: boolean };
  expect(healthPayload.configured).toBe(true);
  expect(healthPayload.reachable).toBe(true);
  expect(healthPayload.readOnlyProbe).toBe(true);

  expect((await request.get('/api/audit?limit=5')).status()).toBe(401);
  expect((await request.get('/api/export')).status()).toBe(401);
});
