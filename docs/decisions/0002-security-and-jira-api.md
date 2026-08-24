# ADR 0002 - Seguridad, OAuth y Jira Cloud API

## Decision

La app final usa Atlassian OAuth 2.0 3LO, no API token manual, para cumplir la memoria y evitar registro local. Las llamadas a Jira con OAuth se hacen mediante `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`.

## Practicas aplicadas

- Uso de `state` en OAuth para mitigar CSRF en el callback de autenticacion.
- Sesion propia con cookie `httpOnly`.
- Tokens OAuth cifrados antes de guardarse.
- Scopes minimos para el MVP: perfil, lectura Jira, JQL, detalle de issues, boards/sprints y `offline_access` para refresh token rotatorio.
- Logs sin secretos.
- CORS restringido por entorno.
- Rate limit propio en API.
- Cache temporal en Redis para lecturas repetidas y estado de sincronizacion.

## Mejoras de seguridad planificadas

- PKCE anadido al flujo OAuth 3LO sin cambiar la experiencia de usuario: `start` genera `code_verifier`/`code_challenge` y `callback` usa el verifier al intercambiar el codigo.
- Proteccion CSRF anadida para endpoints `POST` propios que usan cookie de sesion, especialmente logout y sincronizacion Jira.
- Extraer servicios compartidos de autenticacion y validacion para reducir duplicacion antes de ampliar endpoints.

## Restricciones de Jira API

La sincronizacion debe ser bajo demanda y por ambito. Se pediran solo campos necesarios, se usara paginacion, se registrara `lastSyncAt`, y se respetaran respuestas `429` con `Retry-After` y backoff con jitter.

## Fuentes

- Atlassian REST API auth: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- Atlassian rate limiting: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
- OWASP OAuth2: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
- OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
