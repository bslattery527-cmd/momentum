import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 8081);
const baseURL = `http://127.0.0.1:${port}`;
const workers = Number(process.env.PLAYWRIGHT_WORKERS || 6);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 430, height: 932 },
  },
  webServer: {
    command: `npx expo start --web --non-interactive --port ${port}`,
    cwd: __dirname,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      CI: '1',
      BROWSER: 'none',
      EXPO_NO_TELEMETRY: '1',
    },
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 932 },
      },
    },
  ],
});
