import { expect, test } from '@playwright/test';

const demoDashboard = {
  generatedAt: '2026-08-24T10:00:00.000Z',
  source: 'offline-csv',
  simulation: { tick: 3, refreshMs: 5000 },
  project: { key: 'DEMO', name: 'Nuvlo Demo Project' },
  board: { name: 'Nuvlo Board' },
  summary: {
    leadTime: { average: 10.6, p50: 10, p85: 11 },
    cycleTime: { average: 7.3, p50: 7, p85: 8 },
    wip: 6,
    velocity: 82,
    velocityUnit: 'pts',
    throughput: 16,
    issues: 24,
    activeSprint: 'Nuvlo Sprint 06',
  },
  charts: {
    sprintMetrics: [
      { sprint: 'Sprint 01', committed: 20, completed: 18, wip: 2, done: 4 },
      { sprint: 'Sprint 02', committed: 22, completed: 19, wip: 3, done: 5 },
      { sprint: 'Sprint 03', committed: 18, completed: 16, wip: 2, done: 4 },
    ],
    throughput: [],
    statusBreakdown: [],
  },
  recentIssues: [
    { key: 'DEMO-1', summary: 'Preparar OAuth Atlassian', status: 'Done', type: 'Task', points: 5, assignee: 'Angel', updatedAt: '2026-08-24T09:00:00.000Z' },
    { key: 'DEMO-2', summary: 'Medir WIP del tablero', status: 'In Progress', type: 'Story', points: 8, assignee: 'Angel', updatedAt: '2026-08-24T08:00:00.000Z' },
    { key: 'DEMO-3', summary: 'Revisar alertas por umbral', status: 'Review', type: 'Bug', points: 3, assignee: 'Nuvlo', updatedAt: '2026-08-23T08:00:00.000Z' },
  ],
  issues: [
    { key: 'DEMO-1', summary: 'Preparar OAuth Atlassian', status: 'Done', type: 'Task', points: 5, assignee: 'Angel', updatedAt: '2026-08-24T09:00:00.000Z' },
    { key: 'DEMO-2', summary: 'Medir WIP del tablero', status: 'In Progress', type: 'Story', points: 8, assignee: 'Angel', updatedAt: '2026-08-24T08:00:00.000Z' },
    { key: 'DEMO-3', summary: 'Revisar alertas por umbral', status: 'Review', type: 'Bug', points: 3, assignee: 'Nuvlo', updatedAt: '2026-08-23T08:00:00.000Z' },
    { key: 'DEMO-4', summary: 'Documentar demo offline', status: 'To Do', type: 'Task', points: 2, assignee: 'Angel', updatedAt: '2026-08-22T08:00:00.000Z' },
  ],
  warnings: [
    { title: 'Demo offline', message: 'Datos simulados sin llamadas a Jira.' },
  ],
};

async function mockApi(page) {
  await page.route('http://localhost:3002/api/jira/projects', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'AUTH_REQUIRED' }),
  }));
  await page.route('http://localhost:3002/api/dashboard/demo', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(demoDashboard),
  }));
}

test('landing exposes Jira connection and local demo entry points', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  await expect(page.getByText('Nuvlo', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conectar con Jira' })).toHaveAttribute('href', /api\/auth\/atlassian\/start/);
  await expect(page.getByRole('link', { name: 'Ver demo local' })).toHaveAttribute('href', '/dashboard');
});

test('dashboard demo supports alert popover, filters and configurable widgets', async ({ page }) => {
  await mockApi(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Panel de flujo agile' })).toBeVisible();
  await expect(page.locator('.alert-badge')).toHaveText('2');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByLabel('Alertas activas: 2').click();
  await expect(page.getByText('Avisos activos')).toBeVisible();
  await expect(page.getByText('WIP por encima del objetivo')).toBeVisible();

  await page.getByRole('button', { name: /Filtros/ }).click();
  await expect(page.getByText('Widgets visibles')).toBeVisible();

  await page.getByLabel('WIP').uncheck();
  await expect(page.getByText('WIP visible')).toBeHidden();

  await page.getByLabel('Busqueda').fill('OAuth');
  await expect(page.getByText('1 de 4 issues visibles')).toBeVisible();
  await expect(page.getByText('Preparar OAuth Atlassian')).toBeVisible();
});
