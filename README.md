# Nuvlo - Dashboard de metricas agiles para Jira Cloud

Nuvlo es el proyecto final del TFG: una aplicacion web para centralizar datos de Jira Cloud y visualizar metricas agiles de Scrum/Kanban. El nombre combina **nube + flujo**: datos cloud de Jira aplicados al analisis del flujo de trabajo.

Este repositorio contiene tanto la memoria LaTeX como la aplicacion final. El objetivo es mantener un historico claro en GitHub, con commits pequenos y defendibles para el TFG.

## Estructura

```txt
tfg/
├── apps/
│   ├── web/          # React + Vite
│   └── api/          # Node.js + Express
├── packages/
│   └── shared/       # Contratos y constantes compartidas
├── prisma/           # Schema, migraciones y seed demo
├── docs/
│   ├── memoria/      # Memoria LaTeX del TFG
│   └── decisions/    # Decisiones de arquitectura
├── src/jira-backend-test/ # PoC historico de conexion Jira
├── docker-compose.yml
└── package.json      # npm workspaces
```

## Por que monorepo

El proyecto usa un monorepo sencillo con npm workspaces porque frontend, backend, Prisma, dataset demo, documentacion y pruebas evolucionan juntos. Esto simplifica instalacion, revision academica, commits historicos y trazabilidad. No se usa Turborepo inicialmente para evitar complejidad innecesaria en un TFG individual.

## Stack de la aplicacion

- Frontend: React + Vite.
- Backend: Node.js 24 LTS + Express.
- Persistencia: PostgreSQL + Prisma.
- Cache/soporte operativo: Redis.
- Integracion externa: Atlassian OAuth 2.0 3LO + Jira Cloud REST API.
- Validacion: Vitest, pruebas de integracion y Playwright para E2E.
- Runtime local recomendado: Node.js 24 LTS y npm 11.

## Lectura del codigo

El codigo se mantiene con comentarios cortos solo en los puntos donde hay una decision tecnica relevante. Para entender el flujo principal:

- `apps/api/src/app.js` define los endpoints HTTP y separa autenticacion, lectura Jira, sincronizacion, alertas y demo offline.
- `apps/api/src/services/authRepository.js` centraliza la sesion Atlassian: renovacion de tokens, descifrado de access token y seleccion del sitio Jira.
- `apps/api/src/services/jiraSync.js` contiene la importacion real desde Jira hacia PostgreSQL; por eso documenta deteccion de campos custom, paginacion `nextPageToken`, fallback de sprints y transiciones.
- `apps/web/src/App.jsx` mantiene el estado raiz de la UI: demo offline, datos Jira, sincronizacion, alertas y navegacion interna.
- `apps/web/src/views/DashboardView.jsx` aplica filtros y widgets visibles en cliente, sin volver a llamar a Jira.

La regla de estilo es evitar comentarios obvios y comentar solo aquello que ayuda a defender el diseno: seguridad OAuth/CSRF, cache Redis, persistencia PostgreSQL, calculo propio de metricas y demo offline.

## Pruebas

```bash
npm test          # unitarias e integracion backend reproducibles
npm run test:e2e  # Playwright sobre la demo local de la UI
npm run docs:screenshots:demo  # capturas offline estables para ensayos/presentacion
npm run docs:screenshots:jira  # capturas reales para la memoria con sesion OAuth activa
```

Las pruebas de integracion del backend usan `supertest` y mocks para no llamar a Jira real. Las pruebas E2E interceptan la API desde el navegador y validan el flujo demo: entrada local, filtros, widgets configurables y campana de alertas. Si Playwright indica que falta el navegador Chromium, ejecuta:

```bash
npx playwright install chromium
```

## Desarrollo local de Nuvlo

```bash
node --version
npm --version
cp .env.example .env
# Edita .env y cambia POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY y claves OAuth.
npm install
docker compose up -d
npm run db:generate
npm run demo:data
npm run db:push
npm run db:seed
npm run dev
```

La web arranca en `http://localhost:5174` y la API en `http://localhost:3002`.

La demo visual sigue el planteamiento de los prototipos de `docs/memoria/diagrams`: navegacion lateral con Dashboard, Tablero, Alertas, Actividad, Configuracion y proyectos importados. Algunas vistas se iran implementando progresivamente, pero la estructura ya queda alineada con la memoria.

Para capturas reproducibles de la API demo puedes fijar `DEMO_FIXED_TICK=3` en `.env`.

Rutas demo disponibles: `/dashboard`, `/dashboard/board`, `/dashboard/alerts`, `/dashboard/activity` y `/dashboard/settings`. Todas usan el dataset CSV offline y se actualizan cada 5 segundos para simular una sincronizacion.

## Capturas y datos de demostracion

- Las capturas principales de la memoria deben generarse contra Jira real con `npm run docs:screenshots:jira`. Este comando requiere haber iniciado sesion con Atlassian OAuth al menos una vez y tener el proyecto `TFG` sincronizable.
- La demo offline se genera con `npm run docs:screenshots:demo` y se guarda en `docs/memoria/img/app-demo`. Su objetivo es servir como respaldo estable para la presentacion si Jira Cloud o la red fallan.
- El proyecto Jira real se usa para validar integracion OAuth/API y sincronizacion. El dataset offline se usa para validar metricas historicas con tiempos realistas, porque Jira no permite reconstruir de forma fiable un changelog historico artificial desde la API de lectura de Nuvlo.

> Nota: si trabajas dentro de WSL, usa Node.js 24 LTS dentro de Ubuntu antes de ejecutar los scripts de la app. El entorno Windows puede tener Node instalado, pero no siempre puede acceder al filesystem de WSL por permisos.



## Dataset Jira realista

Para preparar una demo historica dentro de Jira Cloud sin que Nuvlo escriba datos en Jira:

```bash
npm run jira-demo:data
npm run jira-demo:check
```

El comando genera un CSV piloto, otro con las incidencias restantes y otro completo en `data/jira-demo/`. La guia de importacion esta en `docs/jira-demo-dataset.md` e incluye el mapeo recomendado para Jira Cloud, los campos auxiliares `Nuvlo Started At` y `Nuvlo Done At`, y el flujo para sincronizar despues el proyecto `PCC` desde Nuvlo.

## Acceso a PostgreSQL y Redis

Para inspeccion rapida por CLI:

```bash
docker exec -it nuvlo_postgres psql -U nuvlo -d nuvlo
docker exec -it nuvlo_redis redis-cli
```

Comandos utiles dentro de PostgreSQL:

```sql
\dt
SELECT email, "displayName" FROM "User";
SELECT "siteUrl", scopes, "expiresAt" FROM "AtlassianSession";
```

Comandos utiles dentro de Redis:

```txt
PING
KEYS *
INFO memory
```

Tambien hay UIs opcionales mediante perfil Docker:

```bash
docker compose --profile tools up -d
```

- pgAdmin: `http://localhost:5050`. Login con `PGADMIN_DEFAULT_EMAIL` y `PGADMIN_DEFAULT_PASSWORD` del `.env`. Para registrar el servidor usa host `postgres`, puerto `5432`, base `nuvlo`, usuario `nuvlo` y la contrasena `POSTGRES_PASSWORD`.
- RedisInsight: `http://localhost:5540`. Para conectar Redis usa host `redis` y puerto `6379`.

Estas herramientas no se levantan por defecto para mantener ligero el entorno local.


## Politica de retencion y expiracion

Nuvlo separa datos temporales y datos durables:

- Redis conserva cache operativo con TTL: proyectos/issues Jira durante 60 segundos y estado temporal de sincronizacion durante 1 hora.
- PostgreSQL conserva datos de negocio necesarios para trazabilidad: usuarios, sesiones Atlassian cifradas, proyectos, issues, sprints, transiciones, reglas de alerta y datos historicos.
- Los access tokens de Atlassian expiran; el backend usa refresh token rotatorio cifrado para renovarlos.
- La cookie propia de Nuvlo se renueva de forma deslizante mientras el usuario usa la app; si caduca, la UI permite reconectar Jira.

La limpieza de tablas historicas se ejecuta con:

```bash
npm run db:cleanup:dry  # simula lo que se borraria
npm run db:cleanup      # aplica la limpieza real
```

Valores por defecto configurables en `.env`:

```txt
RETENTION_ACTIVITY_LOG_DAYS=90
RETENTION_SYNC_RUN_DAYS=180
RETENTION_ALERT_EVENT_DAYS=180
RETENTION_METRIC_DAYS=365
```

La limpieza borra `ActivityLog`, `SyncRun`, `Metric` y solo `AlertEvent` resueltos antiguos. Las alertas activas sin resolver no se eliminan para no ocultar avisos vigentes. Cada limpieza real registra un evento `ActivityLog` de auditoria con el resumen de registros borrados.


## Configurar OAuth Atlassian en local

1. Crea una app OAuth 2.0 en Atlassian Developer Console.
2. Anade como callback URL: `http://localhost:3002/api/auth/atlassian/callback`.
3. Configura en `.env` `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET` y `ATLASSIAN_REDIRECT_URI`.
4. Genera secretos locales fuertes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Usa el primer valor para `ENCRYPTION_KEY` y el segundo para `JWT_SECRET`. No los subas a Git.

El flujo real empieza en `http://localhost:3002/api/auth/atlassian/start`, redirige a Atlassian y vuelve a `/dashboard` si el callback termina correctamente.

Con sesion OAuth activa, `GET /api/jira/projects` lee los proyectos reales del sitio Jira autorizado y la vista `/dashboard/settings` los muestra junto al modo demo.
Tambien se expone `GET /api/jira/projects/:projectKey/issues`, que usa `search/jql` de Jira Cloud para leer issues del proyecto autorizado y alimentar el tablero real cuando hay sesion OAuth.

## Seguridad

- No hay registro local ni contrasena propia.
- El login final se hace con Atlassian OAuth.
- Las sesiones se guardan en cookies `httpOnly`.
- Los tokens OAuth se cifran antes de persistirse.
- Las llamadas Jira OAuth usan `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`.
- No se deben subir `.env`, tokens, credenciales, contrasenas locales ni salidas con secretos.

## Uso de IA y codigo externo

La documentacion de cumplimiento, uso de IA y fuentes se mantiene localmente hasta revisarla con los tutores. El repositorio publico conserva por ahora las decisiones tecnicas generales en `docs/decisions/`, y no debe incluir tokens, `.env`, notas privadas ni material auxiliar no validado.

Consulta:

- `docs/decisions/0001-monorepo-workspaces.md`
- `docs/decisions/0002-security-and-jira-api.md`
- `docs/decisions/0003-testing-strategy.md`
- `docs/decisions/0004-atlassian-oauth-flow.md`

---

# Memoria del TFG - Guia rapida

## Requisitos para compilar la memoria

Instalar en Ubuntu / WSL:

```bash
sudo apt update
sudo apt install -y make latexmk biber inotify-tools texlive-latex-base texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended texlive-lang-spanish
```

Esto instala lo necesario para compilar la memoria.

## Compilar la memoria

```bash
cd docs/memoria
make
```

Limpiar archivos temporales:

```bash
make clean
```

El PDF generado sera:

```txt
tf.pdf
```

## Autocompilacion al guardar

Para recompilar automaticamente cuando cambies un `.tex`:

```bash
cd docs/memoria
./auto.sh
```

Deja esa terminal abierta mientras trabajas.

## Configuracion recomendada de VS Code

Instalar extensiones:

- LaTeX Workshop
- WSL si usas Windows

Abrir el proyecto desde WSL:

```bash
code .
```

Abrir el PDF con:

```txt
LaTeX Workshop: View LaTeX PDF
```

Atajos utiles:

- `Ctrl + click` en PDF: ir al codigo.
- `Ctrl + Alt + J`: ir del codigo al PDF.

---

# GitHub y flujo de trabajo

## Configurar GitHub en un dispositivo nuevo

Crear clave SSH:

```bash
ssh-keygen -t ed25519 -C "tu_email"
```

Anadir la clave al agente:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

Mostrar la clave publica:

```bash
cat ~/.ssh/id_ed25519.pub
```

Copiarla en GitHub:

```txt
Settings -> SSH and GPG Keys -> New SSH Key
```

Probar conexion:

```bash
ssh -T git@github.com
```

## Clonar el repositorio

```bash
git clone git@github.com:Bania1/tfg.git
cd tfg
```

## Flujo basico de trabajo

```bash
git status
git pull
git add -A
git commit -m "mensaje del cambio"
git push
```

## Buenas practicas

- Ejecutar `git pull` antes de empezar a trabajar.
- Hacer commits pequenos y frecuentes.
- No subir archivos de compilacion, `node_modules`, `.env` ni tokens.
- Documentar cambios relevantes en README o `docs/decisions`.
- Mantener fuera de Git las notas privadas de trabajo, por ejemplo `docs/compliance/` y `.local-notes/`, hasta validarlas con tutores.
