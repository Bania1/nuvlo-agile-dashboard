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

> Nota: si trabajas dentro de WSL, usa Node.js 24 LTS dentro de Ubuntu antes de ejecutar los scripts de la app. El entorno Windows puede tener Node instalado, pero no siempre puede acceder al filesystem de WSL por permisos.

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
