import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';

const cookieName = 'nuvlo_session';
const sessionMaxAgeMs = 60 * 60 * 1000;

function requireJwtSecret() {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required for sessions.');
  return env.JWT_SECRET;
}

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, atlassianAccountId: user.atlassianAccountId },
    requireJwtSecret(),
    { expiresIn: '1h', issuer: 'nuvlo-api', audience: 'nuvlo-web' }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: sessionMaxAgeMs,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, { path: '/' });
}

export function authRequired(req, res, next) {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    req.session = jwt.verify(token, requireJwtSecret(), {
      issuer: 'nuvlo-api',
      audience: 'nuvlo-web',
    });
    setSessionCookie(res, signSession({
      id: req.session.sub,
      atlassianAccountId: req.session.atlassianAccountId,
    }));
    return next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'INVALID_SESSION' });
  }
}
