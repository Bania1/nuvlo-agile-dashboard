import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { mockDemoApi } from '../apps/web/e2e/fixtures/demoDashboard.js';

const outputDir = resolve('docs/memoria/img/app-demo');
const baseUrl = 'http://127.0.0.1:5174';

function waitForServer(url, timeoutMs = 20_000) {
  const startedAt = Date.now();
  return new Promise((resolveWait, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolveWait();
      } catch {
        // Vite is still starting.
      }
      if (Date.now() - startedAt > timeoutMs) return reject(new Error(`Timeout waiting for ${url}`));
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

async function preparePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      .view-transition,
      .analysis-panel,
      .alert-toast {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
      }
    `,
  }).catch(() => {});
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(450);
}

async function closeToastIfVisible(page) {
  await page.getByRole('button', { name: 'Cerrar' }).click({ timeout: 1500 }).catch(() => {});
}

async function capture(page, path, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.mouse.move(20, 20);
  await closeToastIfVisible(page);
  await preparePage(page);
  await settle(page);
  await page.screenshot({ path: resolve(outputDir, path), fullPage: true });
  console.log(`[nuvlo] Captura demo generada: docs/memoria/img/app-demo/${path}`);
}

await mkdir(outputDir, { recursive: true });

const server = spawn('npm', ['run', 'dev', '--workspace=@nuvlo/web', '--', '--host', '127.0.0.1', '--port', '5174'], {
  stdio: 'ignore',
  shell: false,
});

try {
  await waitForServer(baseUrl);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await mockDemoApi(page, { jiraProjectsStatus: 204 });

  await page.goto(`${baseUrl}/`);
  await capture(page, '01-login-jira.png');

  await page.goto(`${baseUrl}/dashboard`);
  await closeToastIfVisible(page);
  await capture(page, '02-dashboard-principal.png');

  await page.getByRole('button', { name: /Filtros/ }).click();
  await capture(page, '03-dashboard-filtros-widgets.png');

  await page.goto(`${baseUrl}/dashboard/board`);
  await capture(page, '04-tablero-flujo.png');

  await page.goto(`${baseUrl}/dashboard/alerts`);
  await capture(page, '05-alertas-historial.png');

  await page.goto(`${baseUrl}/dashboard/activity`);
  await capture(page, '06-registro-actividad.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/dashboard`);
  await closeToastIfVisible(page);
  await capture(page, '07-dashboard-movil.png', { width: 390, height: 844 });

  await browser.close();
} finally {
  server.kill('SIGTERM');
}
