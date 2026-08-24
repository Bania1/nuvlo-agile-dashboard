# 0005 - Separar Jira real y demo offline para validacion

## Estado

Aceptada.

## Contexto

Nuvlo necesita demostrar dos cosas distintas:

- que la integracion real con Atlassian OAuth y Jira Cloud funciona;
- que el calculo de metricas agiles es correcto y reproducible.

Jira Cloud permite leer issues, sprints y changelog mediante la API, pero no es adecuado usar la app final para fabricar historiales antiguos de transiciones. Si las issues se crean y se mueven el mismo dia, Lead Time y Cycle Time pueden ser cero aunque la implementacion sea correcta.

## Decision

Se separan los usos de datos:

- Jira real se usa para capturas de integracion, autenticacion OAuth, sincronizacion, proyectos importados, issues reales, alertas y logs.
- El dataset offline controlado se usa para validar metricas historicas con valores esperados, especialmente Lead Time, Cycle Time, percentiles, WIP y Velocity.

Las capturas Jira se generan en `docs/memoria/img/app-jira` con:

```bash
npm run docs:screenshots:jira
```

Las capturas offline de respaldo se generan en `docs/memoria/img/app-demo` con:

```bash
npm run docs:screenshots:demo
```

## Consecuencias

La memoria puede explicar de forma honesta que Jira real valida la integracion externa y que el dataset offline valida los calculos historicos reproducibles. Esto evita presentar datos artificiales como si fueran historial real de Jira y mantiene el principio de minimo privilegio: Nuvlo no necesita scopes de escritura para poblar demos.
