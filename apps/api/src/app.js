import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRequired, clearSessionCookie, setSessionCookie, signSession } from './security/session.js';
import { createAuthorizationRequest, exchangeAuthorizationCode, fetchAccessibleResources, fetchAtlassianProfile } from './services/atlassianOAuth.js';
import { getAuthenticatedUser, getLatestAtlassianSession, persistAtlassianLogin } from './services/authRepository.js';
import { buildDemoDashboard } from './services/demoDashboard.js';
import { jiraRequest } from './services/jiraClient.js';
import { decryptSecret } from './utils/crypto.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  async function getActiveAtlassianAccess(userId) {
    const atlassianSession = await getLatestAtlassianSession(userId);
    if (!atlassianSession) {
      const error = new Error('Atlassian session not found.');
      error.statusCode = 404;
      error.code = 'ATLASSIAN_SESSION_NOT_FOUND';
      throw error;
    }
    if (atlassianSession.expiresAt && atlassianSession.expiresAt <= new Date()) {
      const error = new Error('Reconnect Jira to refresh access.');
      error.statusCode = 401;
      error.code = 'ATLASSIAN_TOKEN_EXPIRED';
      throw error;
    }
    return {
      atlassianSession,
      accessToken: decryptSecret(atlassianSession.encryptedAccessToken),
    };
  }

  app.get('/api/health', (_req, res) => {
    res.json({ name: 'Nuvlo API', status: 'ok' });
  });

  app.get('/api/auth/atlassian/start', (req, res, next) => {
    try {
      const { state, url } = createAuthorizationRequest();
      res.cookie('nuvlo_oauth_state', state, {
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

  app.get('/api/auth/atlassian/callback', async (req, res, next) => {
    try {
      if (!req.query.state || req.query.state !== req.cookies?.nuvlo_oauth_state) {
        return res.status(400).json({ error: 'INVALID_OAUTH_STATE' });
      }
      if (!req.query.code) return res.status(400).json({ error: 'MISSING_AUTHORIZATION_CODE' });
      const tokenSet = await exchangeAuthorizationCode(req.query.code);
      const [profile, resources] = await Promise.all([
        fetchAtlassianProfile(tokenSet.access_token),
        fetchAccessibleResources(tokenSet.access_token),
      ]);
      const { user } = await persistAtlassianLogin({ profile, tokenSet, resources });
      res.clearCookie('nuvlo_oauth_state', { path: '/' });
      setSessionCookie(res, signSession(user));
      res.redirect(`${env.WEB_ORIGIN}/dashboard`);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', authRequired, async (req, res, next) => {
    try {
      const user = await getAuthenticatedUser(req.session.sub);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/me', authRequired, async (req, res, next) => {
    try {
      const user = await getAuthenticatedUser(req.session.sub);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/jira/projects', authRequired, async (req, res, next) => {
    try {
      const { atlassianSession, accessToken } = await getActiveAtlassianAccess(req.session.sub);
      const payload = await jiraRequest({
        cloudId: atlassianSession.cloudId,
        accessToken,
        path: '/project/search',
        searchParams: { maxResults: 50, orderBy: 'name' },
      });

      return res.json({
        source: 'jira-cloud',
        site: {
          cloudId: atlassianSession.cloudId,
          name: atlassianSession.siteName,
          url: atlassianSession.siteUrl,
        },
        projects: (payload.values || []).map((project) => ({
          id: project.id,
          key: project.key,
          name: project.name,
          projectTypeKey: project.projectTypeKey,
          simplified: project.simplified,
          avatarUrl: project.avatarUrls?.['48x48'] || project.avatarUrls?.['32x32'] || null,
        })),
      });
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

      return res.json({
        source: 'jira-cloud',
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
      });
    } catch (error) {
      next(error);
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
