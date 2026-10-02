import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'clients-functional.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3103', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3103', url: 'http://127.0.0.1:3103/clientes', reuseExistingServer: true, timeout: 120000, env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' } },
});


