import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createApp } from '../apps/api/src/app.js';
import { closeRedis } from '../apps/api/src/cache/redis.js';
import { env } from '../apps/api/src/config/env.js';
import { prisma } from '../apps/api/src/db/prisma.js';
import { signSession } from '../apps/api/src/security/session.js';

const projectKey = (process.env.JIRA_SCREENSHOT_PROJECT_KEY || 'TFG').toUpperCase();
const outputDir = resolve('docs/memoria/img/app-jira');
const webUrl = process.env.JIRA_SCREENSHOT_WEB_URL || 'http://localhost:5174';
const apiUrl = process.env.JIRA_SCREENSHOT_API_URL || `http://localhost:${env.API_PORT}`;
const desktopViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function isAvailable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isAvailable(url)) return;
    await wait(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function startApiIfNeeded() {
  if (await isAvailable(`${apiUrl}/api/health`)) return null;
  const app = createApp();
  const server = await new Promise((resolveListen, reject) => {
    const instance = app.listen(env.API_PORT, () => resolveListen(instance));
    instance.on('error', reject);
  });
  await waitForServer(`${apiUrl}/api/health`);
  return server;
}

async function startWebIfNeeded() {
  if (await isAvailable(webUrl)) return null;
  const server = spawn(
    'npm',
    ['run', 'dev', '--workspace=@nuvlo/web', '--', '--host', '0.0.0.0', '--port', '5174'],
    { stdio: 'ignore', shell: false },
  );
  await waitForServer(webUrl);
  return server;
}

function latestSessionFor(user) {
  return [...user.sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] || null;
}

async function findScreenshotUser() {
  const user = await prisma.user.findFirst({
    where: { sessions: { some: {} } },
    orderBy: { updatedAt: 'desc' },
    include: { sessions: true },
  });
  if (!user) {
    throw new Error('No hay ningun usuario con sesion Atlassian. Entra con Jira antes de generar capturas reales.');
  }
  return user;
}

async function postSync({ sessionToken }) {
  const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`, {
    headers: { Cookie: `nuvlo_session=${sessionToken}` },
  });
  if (!csrfResponse.ok) {
    throw new Error(`No se pudo obtener CSRF para capturas Jira: HTTP ${csrfResponse.status}`);
  }
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${apiUrl}/api/jira/projects/${projectKey}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: `nuvlo_session=${sessionToken}; nuvlo_csrf=${csrfToken}`,
    },
    body: JSON.stringify({ maxIssues: 100 }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`No se pudo sincronizar ${projectKey}: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function ensureScreenshotAlerts({ userId, cloudId }) {
  const project = await prisma.jiraProject.findFirst({ where: { cloudId, key: projectKey } });
  if (!project) {
    throw new Error(`El proyecto ${projectKey} todavia no existe en PostgreSQL. Ejecuta una sincronizacion Jira primero.`);
  }
  const scopeId = `${userId}:${project.id}:default`;
  await prisma.analysisScope.upsert({
    where: { id: scopeId },
    update: { projectId: project.id },
    create: {
      id: scopeId,
      userId,
      projectId: project.id,
      name: `${project.key} - Analisis principal`,
      labels: [],
      issueTypes: [],
      startStatuses: ['In Progress', 'Review', 'En curso'],
      doneStatuses: ['Done', 'Finalizada', 'Finalizado'],
      percentileMarks: [50, 85],
    },
  });
  const rules = [
    { id: `${scopeId}:screenshot-wip`, metricType: 'WIP', operator: 'GT', threshold: 10 },
    { id: `${scopeId}:screenshot-velocity`, metricType: 'VELOCITY', operator: 'GT', threshold: 200 },
  ];
  for (const { id, ...rule } of rules) {
    await prisma.alertRule.upsert({
      where: { id },
      update: { enabled: true, ...rule },
      create: { id, scopeId, enabled: true, ...rule },
    });
  }
}

async function capture(page, name, viewport = desktopViewport, options = {}) {
  await page.setViewportSize(viewport);
  await page.mouse.move(8, 8);
  await closeToastIfVisible(page);
  await wait(300);
  await page.screenshot({
    path: resolve(outputDir, name),
    fullPage: options.fullPage ?? true,
    clip: options.clip,
  });
  console.log(`[nuvlo] Captura Jira generada: docs/memoria/img/app-jira/${name}`);
}

async function closeToastIfVisible(page) {
  await page.getByRole('button', { name: 'Cerrar' }).click({ timeout: 2_000 }).catch(() => {});
}

async function waitForJiraDashboard(page) {
  await page.goto(`${webUrl}/dashboard`);
  await page.getByRole('heading', { name: 'Panel de flujo agile' }).waitFor({ timeout: 20_000 });
  await page.getByText(projectKey, { exact: false }).first().waitFor({ timeout: 20_000 }).catch(() => {});
  await wait(1_000);
}

await mkdir(outputDir, { recursive: true });

let apiServer = null;
let webServer = null;
let browser = null;

try {
  apiServer = await startApiIfNeeded();
  webServer = await startWebIfNeeded();

  const user = await findScreenshotUser();
  const atlassianSession = latestSessionFor(user);
  const sessionToken = signSession(user);

  console.log(`[nuvlo] Sincronizando proyecto Jira ${projectKey} antes de capturar...`);
  const sync = await postSync({ sessionToken });
  console.log(`[nuvlo] Sync completada: ${JSON.stringify(sync.imported)}`);
  await ensureScreenshotAlerts({ userId: user.id, cloudId: atlassianSession.cloudId });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: desktopViewport });
  await context.addCookies([
    {
      name: 'nuvlo_session',
      value: sessionToken,
      url: apiUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();

  await waitForJiraDashboard(page);
  await closeToastIfVisible(page);
  await capture(page, '01-dashboard-jira.png');

  await page.getByRole('button', { name: /Filtros/ }).click();
  await wait(400);
  await capture(page, '02-dashboard-jira-filtros.png');

  await page.goto(`${webUrl}/dashboard/board`);
  await page.getByRole('heading', { name: 'Tablero de flujo' }).waitFor({ timeout: 20_000 }).catch(() => {});
  await wait(700);
  await capture(page, '03-tablero-jira.png', desktopViewport, {
    fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 1400 },
  });

  await page.goto(`${webUrl}/dashboard/alerts`);
  await page.getByRole('heading', { name: /Alertas|Nueva regla/ }).waitFor({ timeout: 20_000 }).catch(() => {});
  await wait(700);
  await capture(page, '04-alertas-jira.png');

  await page.goto(`${webUrl}/dashboard/activity`);
  await page.getByRole('heading', { name: /Actividad|Registro/ }).waitFor({ timeout: 20_000 }).catch(() => {});
  await wait(700);
  await capture(page, '05-actividad-jira.png');

  await page.goto(`${webUrl}/dashboard/settings`);
  await page.getByRole('heading', { name: /Configuracion|Conexion/ }).waitFor({ timeout: 20_000 }).catch(() => {});
  await wait(700);
  await capture(page, '06-configuracion-jira.png');

  await page.setViewportSize(mobileViewport);
  await page.goto(`${webUrl}/dashboard`);
  await page.getByRole('heading', { name: 'Panel de flujo agile' }).waitFor({ timeout: 20_000 });
  await closeToastIfVisible(page);
  await wait(700);
  await capture(page, '07-dashboard-jira-movil.png', mobileViewport);

  await context.close();
} finally {
  if (browser) await browser.close().catch(() => {});
  if (apiServer) {
    await new Promise((resolveClose) => apiServer.close(resolveClose));
  }
  if (webServer) webServer.kill('SIGTERM');
  await closeRedis();
  await prisma.$disconnect();
}
