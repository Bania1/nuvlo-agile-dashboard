# ADR 0003 - Estrategia de pruebas

## Decision

Nuvlo usa una piramide de pruebas sencilla:

- Vitest para logica pura: metricas, percentiles, alertas y validaciones.
- Tests de integracion para API, repositorios, sync y errores Jira.
- Playwright para flujos visibles: login simulado, seleccion de ambito, dashboard, filtros, alertas y logs.
- Dataset demo para validar sin depender de Jira real.

## Criterio

Las pruebas deben validar comportamiento observable y requisitos de la memoria, no detalles accidentales de implementacion.

## Fuentes

- Vitest: https://vitest.dev/guide/
- Playwright best practices: https://playwright.dev/docs/best-practices
