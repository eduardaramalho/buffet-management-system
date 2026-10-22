import { defineConfig, devices } from '@playwright/test'
import { FRONTEND_ROOT, e2eEnv } from './support/env'

export default defineConfig({
  testDir: './tests',
  // A jornada é uma sequência de passos dependentes sobre o mesmo banco: nada roda em paralelo.
  fullyParallel: false,
  workers: 1,
  // Sem retry: repetir a jornada sobre um banco já alterado mascara falhas (e estoura o limite de login).
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eEnv.frontendUrl,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx scripts/start-backend.ts',
      url: `${e2eEnv.backendUrl}/api/v1/health`,
      // Nunca reaproveita um servidor já aberto: ele poderia estar ligado ao banco de desenvolvimento.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${e2eEnv.frontendPort} --strictPort`,
      cwd: FRONTEND_ROOT,
      url: e2eEnv.frontendUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_PROXY_TARGET: e2eEnv.backendUrl },
    },
  ],
})
