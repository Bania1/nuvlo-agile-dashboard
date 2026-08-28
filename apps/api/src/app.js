import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRequired, clearSessionCookie, setSessionCookie, signSession } from './security/session.js';
import { clearCsrfCookie, csrfRequired, setCsrfCookie } from './security/csrf.js';
import { createAuthorizationRequest, exchangeAuthorizationCode, fetchAccessibleResources, fetchAtlassianProfile } from './services/atlassianOAuth.js';
import { getActiveAtlassianAccess, getAuthenticatedUser, persistAtlassianLogin } from './services/authRepository.js';
import { buildDemoDashboard } from './services/demoDashboard.js';
import { jiraRequest } from './services/jiraClient.js';
import { getJsonCache, getSyncStatus, setJsonCache } from './cache/redis.js';
import { getPersistedProjectIssues, syncJiraProject } from './services/jiraSync.js';
import { buildProjectDashboard } from './services/projectDashboard.js';
import { getActivityLogs } from './services/activityRepository.js';
import { createProjectAlertRule, deleteProjectAlertRule, listProjectAlerts, updateProjectAlertRule } from './services/alertRepository.js';
import { getProjectAnalysisScope, updateProjectAnalysisScope } from './services/analysisScope.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ name: 'Nuvlo API', status: 'ok' });
  });

  // Inicio OAuth 2.0 3LO: state evita CSRF OAuth y PKCE protege el codigo de autorizacion.
  app.get('/api/auth/atlassian/start', (req, res, next) => {
    try {
      const { state, codeVerifier, url } = createAuthorizationRequest();
      res.cookie('nuvlo_oauth_state', state, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
      res.cookie('nuvlo_pkce_verifier', codeVerifier, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  });

  // Callback OAuth: se validan state y PKCE antes de crear la sesion local httpOnly.
  app.get('/api/auth/atlassian/callback', async (req, res, next) => {
    try {
      if (!req.query.state || req.query.state !== req.cookies?.nuvlo_oauth_state) {
        return res.status(400).json({ error: 'INVALID_OAUTH_STATE' });
      }
      if (!req.query.code) return res.status(400).json({ error: 'MISSING_AUTHORIZATION_CODE' });
      const codeVerifier = req.cookies?.nuvlo_pkce_verifier;
      if (!codeVerifier) return res.status(400).json({ error: 'MISSING_PKCE_VERIFIER' });
      const tokenSet = await exchangeAuthorizationCode(req.query.code, codeVerifier);
      const [profile, resources] = await Promise.all([
        fetchAtlassianProfile(tokenSet.access_token),
        fetchAccessibleResources(tokenSet.access_token),
      ]);
      const { user } = await persistAtlassianLogin({ profile, tokenSet, resources });
      res.clearCookie('nuvlo_oauth_state', { path: '/' });
      res.clearCookie('nuvlo_pkce_verifier', { path: '/' });
      setSessionCookie(res, signSession(user));
      setCsrfCookie(res);
      res.redirect(`${env.WEB_ORIGIN}/dashboard`);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', authRequired, csrfRequired, (_req, res) => {
    clearSessionCookie(res);
    clearCsrfCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/csrf', authRequired, (_req, res) => {
    const csrfToken = setCsrfCookie(res);
    res.json({ csrfToken });
  });

  async function respondWithAuthenticatedUser(req, res, next) {
    try {
      const user = await getAuthenticatedUser(req.session.sub);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  }

  app.get('/api/auth/me', authRequired, respondWithAuthenticatedUser);
  app.get('/api/me', authRequired, respondWithAuthenticatedUser);

  app.get('/api/activity', authRequired, async (req, res, next) => {
    try {
      const events = await getActivityLogs({ userId: req.session.sub, limit: req.query.limit });
      return res.json({ source: 'postgres', events });
    } catch (error) {
      return next(error);
    }
  });

  // Lecturas de Jira: Redis cachea respuestas breves para evitar peticiones repetidas al refrescar la UI.
  app.get('/api/jira/projects', authRequired, async (req, res, next) => {
    try {
      const { atlassianSession, accessToken } = await getActiveAtlassianAccess(req.session.sub);
      const cacheKey = `jira:projects:${req.session.sub}:${atlassianSession.cloudId}`;
      const cached = await getJsonCache(cacheKey);
      if (cached) return res.json({ ...cached, cache: 'hit' });

      const payload = await jiraRequest({
        cloudId: atlassianSession.cloudId,
        accessToken,
        path: '/project/search',
        searchParams: { maxResults: 50, orderBy: 'name' },
      });

      const responsePayload = {
        source: 'jira-cloud',
        cache: 'miss',
        site: {
          cloudId: atlassianSession.cloudId,
          name: atlassianSession.siteName,
          url: atlassianSession.siteUrl,
        },
        session: {
          accessTokenExpiresAt: atlassianSession.expiresAt?.toISOString() || null,
          cacheTtlSeconds: 60,
          syncStatusTtlSeconds: 3600,
        },
        projects: (payload.values || []).map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          projectTypeKey: project.projectTypeKey,
          simplified: project.simplified,
          avatarUrl: project.avatarUrls?.['48x48'] || project.avatarUrls?.['32x32'] || null,
        })),
      };
      await setJsonCache(cacheKey, responsePayload, 60);
      return res.json(responsePayload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jira/projects/:projectKey/issues', authRequired, async (req, res, next) => {
    try {
      const projectKey = String(req.params.projectKey || '').toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,20}$/.test(projectKey)) {
        return res.status(400).json({ error: 'INVALID_PROJECT_KEY' });
      }

      const { atlassianSession, accessToken } = await getActiveAtlassianAccess(req.session.sub);
      const persisted = await getPersistedProjectIssues({ cloudId: atlassianSession.cloudId, projectKey });
      if (persisted?.issues?.length) {
        const status = await getSyncStatus(`${req.session.sub}:${projectKey}`);
        return res.json({
          source: 'postgres',
          projectKey,
          syncStatus: status,
          issues: persisted.issues,
        });
      }

      const cacheKey = `jira:issues:${req.session.sub}:${atlassianSession.cloudId}:${projectKey}`;
      const cached = await getJsonCache(cacheKey);
      if (cached) return res.json({ ...cached, cache: 'hit' });

      const payload = await jiraRequest({
        cloudId: atlassianSession.cloudId,
        accessToken,
        path: '/search/jql',
        searchParams: {
          jql: `project = ${projectKey} ORDER BY updated DESC`,
          maxResults: 50,
          fields: ['summary', 'issuetype', 'status', 'priority', 'assignee', 'created', 'updated'],
        },
      });

      const responsePayload = {
        source: 'jira-cloud',
        cache: 'miss',
        projectKey,
        nextPageToken: payload.nextPageToken || null,
        issues: (payload.issues || []).map((issue) => ({
          id: issue.id,
          key: issue.key,
          summary: issue.fields?.summary || '(sin resumen)',
          type: issue.fields?.issuetype?.name || 'Issue',
          status: issue.fields?.status?.name || 'Unknown',
          statusCategory: issue.fields?.status?.statusCategory?.name || null,
          priority: issue.fields?.priority?.name || null,
          assignee: issue.fields?.assignee?.displayName || 'Sin asignar',
          createdAt: issue.fields?.created || null,
          updatedAt: issue.fields?.updated || null,
        })),
      };
      await setJsonCache(cacheKey, responsePayload, 60);
      return res.json(responsePayload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jira/projects/:projectKey/analysis-scope', authRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const payload = await getProjectAnalysisScope({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
      });
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/jira/projects/:projectKey/analysis-scope', authRequired, csrfRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const payload = await updateProjectAnalysisScope({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
        payload: req.body,
      });
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });
  app.get('/api/jira/projects/:projectKey/alerts', authRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const alerts = await listProjectAlerts({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
      });
      return res.json(alerts);
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/jira/projects/:projectKey/alerts', authRequired, csrfRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const rule = await createProjectAlertRule({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
        payload: req.body,
      });
      return res.status(201).json({ source: 'postgres', rule });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/jira/projects/:projectKey/alerts/:ruleId', authRequired, csrfRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const rule = await updateProjectAlertRule({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
        ruleId: req.params.ruleId,
        payload: req.body,
      });
      return res.json({ source: 'postgres', rule });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/jira/projects/:projectKey/alerts/:ruleId', authRequired, csrfRequired, async (req, res, next) => {
    try {
      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const result = await deleteProjectAlertRule({
        userId: req.session.sub,
        cloudId: atlassianSession.cloudId,
        projectKey: req.params.projectKey,
        ruleId: req.params.ruleId,
      });
      return res.json({ source: 'postgres', rule: result });
    } catch (error) {
      return next(error);
    }
  });

  // Sincronizacion bajo demanda: Jira se consulta aqui y la UI lee despues desde PostgreSQL.
  app.post('/api/jira/projects/:projectKey/sync', authRequired, csrfRequired, async (req, res, next) => {
    try {
      const requestedMaxIssues = Number(req.body?.maxIssues || 100);
      const result = await syncJiraProject({
        userId: req.session.sub,
        projectKey: req.params.projectKey,
        maxIssues: Math.min(Math.max(requestedMaxIssues || 100, 1), 250),
      });
      return res.status(201).json({
        source: 'jira-cloud',
        status: 'COMPLETED',
        syncRunId: result.syncRunId,
        project: { id: result.project.id, key: result.project.key, name: result.project.name },
        imported: result.imported,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jira/projects/:projectKey/sync/status', authRequired, async (req, res, next) => {
    try {
      const projectKey = String(req.params.projectKey || '').toUpperCase();
      const status = await getSyncStatus(`${req.session.sub}:${projectKey}`);
      return res.json({ projectKey, status: status || { status: 'IDLE', projectKey } });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jira/projects/:projectKey/dashboard', authRequired, async (req, res, next) => {
    try {
      const projectKey = String(req.params.projectKey || '').toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,20}$/.test(projectKey)) {
        return res.status(400).json({ error: 'INVALID_PROJECT_KEY' });
      }

      const { atlassianSession } = await getActiveAtlassianAccess(req.session.sub);
      const dashboard = await buildProjectDashboard({ cloudId: atlassianSession.cloudId, projectKey, userId: req.session.sub });
      if (!dashboard) {
        return res.status(404).json({ error: 'PROJECT_DASHBOARD_NOT_SYNCED', message: 'Project has no synced issues yet.' });
      }
      return res.json(dashboard);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/dashboard/demo', async (_req, res, next) => {
    try {
      res.json(await buildDemoDashboard());
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || 500;
    const message = status >= 500 ? 'Internal server error' : error.message;
    res.status(status).json({ error: error.code || 'NUVLO_ERROR', message });
  });

  return app;
}

