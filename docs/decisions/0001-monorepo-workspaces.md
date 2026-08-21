# ADR 0001 - Monorepo con npm workspaces

## Decision

Nuvlo se organiza como monorepo con npm workspaces: `apps/web`, `apps/api`, `packages/shared`, `prisma` y `docs`.

## Justificacion

El TFG combina aplicacion web, API, base de datos, datos demo, pruebas y documentacion. Mantenerlo en un solo repositorio facilita la instalacion local, la revision del tribunal y un historico de commits coherente. npm workspaces permite gestionar paquetes locales desde un unico `package.json` raiz sin usar enlaces manuales.

## Alternativas descartadas

- Polyrepo: separa demasiado frontend, backend y documentacion para un proyecto individual.
- Monolito plano: mezcla responsabilidades y dificulta explicar arquitectura por capas.
- Turborepo desde el inicio: util, pero innecesario hasta que los tiempos de build/test lo justifiquen.

## Fuentes

- npm workspaces: https://docs.npmjs.com/cli/v8/using-npm/workspaces/
- Turborepo docs: https://turborepo.dev/docs
