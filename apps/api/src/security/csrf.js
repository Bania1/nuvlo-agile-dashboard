import crypto from 'node:crypto';
import { isProduction } from '../config/env.js';

const csrfCookieName = 'nuvlo_csrf';
const csrfHeaderName = 'x-csrf-token';
const csrfMaxAgeMs = 60 * 60 * 1000;

function newCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function setCsrfCookie(res) {
  const token = newCsrfToken();
  res.cookie(csrfCookieName, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: csrfMaxAgeMs,
    path: '/',
  });
  return token;
}

export function clearCsrfCookie(res) {
  res.clearCookie(csrfCookieName, { path: '/' });
}

// Double-submit cookie: el frontend debe reenviar el token de cookie en la cabecera x-csrf-token.
export function csrfRequired(req, res, next) {
  const cookieToken = req.cookies?.[csrfCookieName];
  const headerToken = req.get(csrfHeaderName);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF_TOKEN_INVALID', message: 'Missing or invalid CSRF token.' });
  }
  return next();
}
