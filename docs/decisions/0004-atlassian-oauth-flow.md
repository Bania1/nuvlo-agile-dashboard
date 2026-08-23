# ADR 0004 - Flujo de autenticacion Atlassian OAuth 2.0 3LO

## Decision

Nuvlo implementa el inicio de sesion mediante Atlassian OAuth 2.0 3LO. No existe registro local: al volver del callback se obtiene el perfil Atlassian, se localiza el sitio Jira autorizado mediante `accessible-resources`, se crea o actualiza el usuario local y se guarda una sesion propia con cookie `httpOnly`.

## Flujo implementado

1. `GET /api/auth/atlassian/start` genera `state`, lo guarda en una cookie `httpOnly` temporal y redirige a Atlassian.
2. Atlassian autentica al usuario y devuelve `code` + `state` al callback configurado.
3. `GET /api/auth/atlassian/callback` valida `state`, intercambia el codigo por tokens y consulta perfil/recursos accesibles.
4. El backend guarda usuario y sesion Atlassian en PostgreSQL. Los tokens se cifran con AES-256-GCM antes de persistirse.
5. El backend crea una cookie propia `nuvlo_session` firmada con JWT y redirige al dashboard.
6. `GET /api/me` devuelve informacion no sensible del usuario y del sitio Jira conectado.
7. `POST /api/auth/logout` elimina la cookie de sesion.

## Seguridad

- Se usa `state` para mitigar CSRF en el flujo OAuth.
- Los tokens OAuth no se envian al frontend y no se guardan en `localStorage`.
- Los tokens se cifran antes de almacenarse con una `ENCRYPTION_KEY` local de 32 bytes en base64.
- La cookie de sesion es `httpOnly`, `sameSite=lax` y `secure` en produccion.
- Los logs de autenticacion registran metadatos no sensibles, nunca tokens.
- Las llamadas futuras a Jira con OAuth usaran `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`.

## Scopes iniciales

`read:me read:jira-work read:jira-user offline_access`

Estos scopes son suficientes para identificar al usuario, leer datos Jira y poder renovar acceso en fases posteriores. Si se anaden operaciones nuevas, se revisaran los scopes siguiendo minimo privilegio.

## Fuentes

- Atlassian OAuth 2.0 3LO apps: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Atlassian Jira Cloud REST API v3 intro: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- Atlassian API calls with cloudId: https://developer.atlassian.com/cloud/oauth/getting-started/making-calls-to-api/
- OWASP OAuth2 Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
