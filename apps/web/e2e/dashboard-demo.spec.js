import { expect, test } from '@playwright/test';
import { mockDemoApi } from './fixtures/demoDashboard.js';

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
