import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'order-finance.spec.ts',
  workers: 1,
  reporter: 'list',
});
