import { expect, test } from '@playwright/test';
import { mockDemoApi, mockJiraProjectsApi } from './fixtures/demoDashboard.js';

test('landing exposes Jira connection and local demo entry points', async ({ page }) => {
  await mockDemoApi(page);
  await page.goto('/');

  await expect(page.getByText('Nuvlo', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conectar con Jira' })).toHaveAttribute('href', /api\/auth\/atlassian\/start/);
  await expect(page.getByRole('link', { name: 'Ver demo local' })).toHaveAttribute('href', '/dashboard');
});

test('dashboard demo supports alert popover, filters and configurable widgets', async ({ page }) => {
  await mockDemoApi(page);
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


test('dashboard switches between Jira projects from the sidebar', async ({ page }) => {
  await mockJiraProjectsApi(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('link', { name: /PCC Plataforma Cliente Cloud/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /TFG TFG Agile Metrics Simulation/ })).toBeVisible();
  await expect(page.getByText('Nuvlo / Plataforma Cliente Cloud / Dashboard')).toBeVisible();
  await expect(page.getByText('PCC-1')).toBeVisible();

  await page.getByRole('link', { name: /TFG TFG Agile Metrics Simulation/ }).click();

  await expect(page.getByText('Nuvlo / TFG Agile Metrics Simulation / Dashboard')).toBeVisible();
  await expect(page.getByText('TFG-1')).toBeVisible();
});

test('board and settings use clear Jira wording', async ({ page }) => {
  await mockJiraProjectsApi(page);
  await page.goto('/dashboard/board');

  await expect(page.getByText('Tablero sincronizado desde Jira', { exact: true })).toBeVisible();
  await expect(page.getByText('Tablero sincronizado desde Jira y consultado desde PostgreSQL para PCC')).toBeVisible();
  await expect(page.getByText(/\d+ puntos/).first()).toBeVisible();
  await expect(page.getByText('Comprometido')).toBeHidden();
  await expect(page.getByText('Sprint actual simulado desde CSV')).toBeHidden();

  await page.goto('/dashboard');
  await expect(page.getByText('Validaciones de datos')).toBeVisible();

  await page.goto('/dashboard/settings');
  await expect(page.getByText('Nuvlo usa este valor como puntos de historia para Velocity')).toBeVisible();
  await expect(page.locator('.issue-type-check-group label')).toHaveCount(1);
  await expect(page.locator('.issue-type-check-group')).toHaveCSS('align-self', 'start');
});

test('invalid local session sends the user back to landing', async ({ page }) => {
  await mockDemoApi(page, { jiraProjectsError: 'INVALID_SESSION' });
  await page.goto('/dashboard');

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Tu sesion ha caducado. Vuelve a conectar Jira para continuar.')).toBeVisible();
});
