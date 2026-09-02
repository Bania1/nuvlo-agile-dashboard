# Dataset Jira realista para Nuvlo

Este documento describe como preparar una demo realista en Jira Cloud usando un CSV controlado. La idea es disponer de un proyecto separado, por ejemplo `PCC`, con unos ocho meses de actividad simulada para que las metricas de Nuvlo sean explicables durante una presentacion.

## Por que se usa CSV

Nuvlo es una aplicacion de solo lectura frente a Jira: sincroniza datos con OAuth y calcula metricas en su propia base de datos, pero no crea ni modifica incidencias en Jira. Por eso el dataset historico se carga manualmente desde Jira mediante CSV.

La importacion CSV de Jira Cloud permite mapear campos como `Summary`, `Issue Type`, `Status`, `Priority`, `Labels`, `Created`, `Updated` y campos personalizados. Sin embargo, no debe asumirse que esa importacion reconstruya un historial completo de transiciones de estado. Para que `Lead Time` y `Cycle Time` puedan validarse con datos historicos, el CSV incluye dos campos auxiliares de solo lectura:

- `Nuvlo Started At`: fecha simulada en la que la incidencia entra en trabajo activo.
- `Nuvlo Done At`: fecha simulada en la que la incidencia queda terminada.

Estos campos no cambian el funcionamiento de Jira ni implican que Nuvlo escriba datos en Jira. Solo sirven como fuente trazable de fechas cuando el changelog real no contiene suficiente historia.

## Archivos generados

Ejecuta:

```bash
npm run jira-demo:data
```

Se generan dos CSV:

- `data/jira-demo/nuvlo-jira-demo-pilot.csv`: muestra de 10 incidencias para probar el importador.
- `data/jira-demo/nuvlo-jira-demo-remaining.csv`: incidencias restantes, pensado para completar el proyecto despues de importar el piloto sin duplicar datos.
- `data/jira-demo/nuvlo-jira-demo-8m.csv`: dataset completo con 16 Sprints y unas 140 incidencias, util si se importa desde cero.

Tambien puedes validar sin reescribir archivos:

```bash
npm run jira-demo:check
```

El generador comprueba que las fechas sean coherentes, que las issues terminadas tengan `Nuvlo Done At`, que las abiertas no tengan fecha de finalizacion y que los puntos sean numericos.

## Preparacion en Jira Cloud

1. Crea un proyecto nuevo y separado del proyecto real. Nombre sugerido: `Plataforma Cliente Cloud`. Clave sugerida: `PCC`.
2. Usa un workflow simple con estos estados: `To Do`, `In Progress`, `Review` y `Done`.
3. Crea o verifica un tablero Scrum asociado al proyecto.
4. Crea dos campos personalizados de tipo fecha/hora o fecha:
   - `Nuvlo Started At`
   - `Nuvlo Done At`
5. Si Jira lo solicita, asocia esos campos a las pantallas del proyecto para que puedan mapearse durante la importacion.

## Importacion recomendada

Primero importa la muestra:

1. Ve a administracion de Jira y abre la importacion CSV.
2. Selecciona el proyecto `PCC`.
3. Sube `data/jira-demo/nuvlo-jira-demo-pilot.csv`.
4. Indica el formato de fechas: `yyyy-MM-dd HH:mm`.
5. Mapea las columnas principales:
   - `Summary` -> `Summary`
   - `Issue Type` -> `Issue Type` o `Work Type`
   - `Status` -> `Status`
   - `Priority` -> `Priority`
   - `Labels` -> `Labels`
   - `Story point estimate` -> `Story point estimate`
   - `Sprint` -> no asignar si Jira pide un ID numerico de Sprint
   - `Created` -> `Created`
   - `Updated` -> `Updated`
   - `Nuvlo Started At` -> campo personalizado `Nuvlo Started At`
   - `Nuvlo Done At` -> campo personalizado `Nuvlo Done At`
   - `Description` -> `Description`
6. Si algun campo como `Sprint` no se puede mapear en tu tipo de proyecto, puedes dejarlo sin importar y usar filtros por estado/proyecto en Nuvlo.
7. Si la muestra se importa correctamente y quieres conservar esas 10 incidencias, repite el proceso con `data/jira-demo/nuvlo-jira-demo-remaining.csv`.
8. Si prefieres empezar desde cero, borra las incidencias piloto y usa `data/jira-demo/nuvlo-jira-demo-8m.csv`.

## Sincronizacion con Nuvlo

1. Arranca PostgreSQL y Redis con `docker compose up -d`.
2. Arranca la aplicacion con `npm run dev`.
3. Entra en `http://localhost:5174` y conecta con Atlassian.
4. Sincroniza el proyecto `PCC`. La app solicita hasta 200 issues por sincronizacion, suficiente para el dataset completo.
5. Revisa el Dashboard, Tablero, Alertas, Actividad y Configuracion.

Si Jira proporciona changelog real de estados, Nuvlo lo usara como fuente principal. Si no hay changelog historico suficiente, los campos `Nuvlo Started At` y `Nuvlo Done At` permiten explicar y validar las metricas temporales del proyecto demo.

## Que deberia verse

- `Velocity` variable entre Sprints, sin parecer plana.
- `WIP` visible en `In Progress` y `Review`.
- `Lead Time` medio en un rango aproximado de 7 a 18 dias.
- `Cycle Time` medio en un rango aproximado de 3 a 10 dias.
- Percentiles `P50` y `P85` diferentes, utiles para explicar dispersion.
- Issues abiertas, bloqueadas y reabiertas simuladas mediante etiquetas.

## Fuentes de referencia

La importacion se basa en documentacion oficial de Atlassian sobre importacion CSV, creacion de work items desde CSV y mapeo de columnas a campos de Jira Cloud:

- https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/
- https://support.atlassian.com/jira-software-cloud/docs/import-data-into-jira/
- https://support.atlassian.com/jira-software-cloud/docs/create-issues-using-the-csv-importer/
- https://support.atlassian.com/jira-software-cloud/docs/mapping-csv-data-to-jira-fields/

Para la memoria, conviene citar esas fuentes junto con la explicacion de que el dataset es controlado y no representa actividad real de una empresa.
