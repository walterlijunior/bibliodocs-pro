// Configuração dos testes E2E (M1-T13; ADR-0006, camada 8). Separada do Vitest: os E2E abrem o Electron real a
// partir do build (`npm run test:e2e` faz o build antes). Sem navegadores do Playwright: só o `_electron`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Instância única do app (C-22): um Electron por vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './test-results',
  use: { trace: 'off', screenshot: 'off' },
});
