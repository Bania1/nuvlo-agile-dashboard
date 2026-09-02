# Guion de demo final de Nuvlo

Este guion sirve para ensayar la presentacion del MVP y tener un plan de respaldo si Jira Cloud, OAuth o la red fallan durante la exposicion.

## Preparacion previa

- Levantar PostgreSQL y Redis con `docker compose up -d`.
- Ejecutar `npm run dev` y abrir `http://localhost:5174`.
- Verificar que existe sesion Jira entrando desde `Conectar con Jira`.
- Ejecutar una sincronizacion real del proyecto `PCC` o del proyecto real disponible antes de la presentacion.
- Tener preparada la demo offline en `/dashboard` por si falla Jira.

## Camino principal con Jira real

1. Abrir Nuvlo y explicar el nombre: nube + flujo.
2. Pulsar `Conectar con Jira` y recordar que no hay registro local.
3. Mostrar que Atlassian OAuth gestiona usuario, permisos y consentimiento.
4. Entrar al dashboard real del proyecto `PCC` si se ha importado el dataset historico, o al proyecto Jira real disponible.
5. Explicar que Nuvlo no calcula desde Jira en cada render: sincroniza Jira, guarda en PostgreSQL y consulta la base local.
6. Pulsar `Sincronizar Jira` para demostrar actualizacion bajo demanda.
7. Mostrar tarjetas de WIP, Velocity, Lead/Cycle Time y avisos de calidad de datos.
8. Abrir `Filtros` y ocultar/mostrar algun widget para demostrar personalizacion.
9. Ir a `Tablero` y enseñar issues reales agrupadas por estado.
10. Ir a `Alertas`, mostrar reglas, badge de campana y eventos recientes.
11. Ir a `Actividad` y enseñar logs de autenticacion, sincronizacion y alertas.
12. Ir a `Configuracion` y mostrar estado OAuth/proyectos disponibles.

## Explicacion importante sobre metricas temporales

En el proyecto Jira real puede ocurrir que Lead Time y Cycle Time aparezcan a cero o con valores muy bajos si las issues se crearon y movieron en poco tiempo. Esto no invalida el calculo: indica que el historial real de transiciones no contiene duraciones amplias. Para validar metricas historicas reproducibles se usa el dataset offline controlado.


## Demo Jira historica con CSV

Para una demostracion mas realista se puede preparar un proyecto Jira separado, `PCC`, importando el CSV generado con:

```bash
npm run jira-demo:data
```

Primero se recomienda importar `data/jira-demo/nuvlo-jira-demo-pilot.csv` para validar el mapeo de campos y despues `data/jira-demo/nuvlo-jira-demo-remaining.csv` para completar el proyecto sin duplicar esas 10 incidencias. El detalle esta en `docs/jira-demo-dataset.md`.

Esta demo sigue siendo un caso de uso real de lectura: los datos estan en Jira y Nuvlo solo los sincroniza mediante OAuth. La diferencia es que el origen historico se ha preparado por CSV para poder mostrar metricas temporales con suficiente recorrido.

## Fallback si falla Jira

1. Entrar en `Ver demo local`.
2. Explicar que la demo offline usa CSV/dataset local y no llama a Jira.
3. Mostrar dashboard con Lead Time, Cycle Time, percentiles, WIP y Velocity.
4. Mostrar filtros, widgets, tablero, alertas y logs.
5. Aclarar que esta demo valida el comportamiento funcional y visual del sistema, mientras que Jira real valida la integracion externa.

## Comandos utiles

```bash
npm run dev
npm run docs:screenshots:jira
npm run docs:screenshots:demo
npm test
npm run test:e2e
npm run build
```

## Mensaje de cierre

Nuvlo es un MVP funcional que integra Jira Cloud, persiste datos en PostgreSQL, usa Redis para cache temporal, calcula metricas agiles, muestra dashboards responsive, permite alertas por umbral y conserva actividad para trazabilidad. El alcance restante queda documentado como mejoras futuras, especialmente filtros avanzados, configuracion completa de analisis y metricas adicionales.
