import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRequired, clearSessionCookie, setSessionCookie, signSession } from './security/session.js';
import { createAuthorizationRequest, exchangeAuthorizationCode, fetchAccessibleResources, fetchAtlassianProfile } from './services/atlassianOAuth.js';
import { buildDemoDashboard } from './services/demoDashboard.js';

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

  app.get('/api/auth/atlassian/start', (req, res, next) => {
    try {
      const { state, url } = createAuthorizationRequest();
      res.cookie('nuvlo_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/' });
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
      const user = {
        id: profile.account_id,
        atlassianAccountId: profile.account_id,
        email: profile.email,
        name: profile.name,
        cloudId: resources[0]?.id,
      };
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

  app.get('/api/auth/me', authRequired, (req, res) => {
    res.json({ userId: req.session.sub, atlassianAccountId: req.session.atlassianAccountId });
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
