import crypto from 'node:crypto';
import { env } from '../config/env.js';

const authorizeUrl = 'https://auth.atlassian.com/authorize';
const tokenUrl = 'https://auth.atlassian.com/oauth/token';
const profileUrl = 'https://api.atlassian.com/me';
const resourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources';

function base64UrlSha256(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function requireOAuthConfig() {
  const missing = [];
  if (!env.ATLASSIAN_CLIENT_ID) missing.push('ATLASSIAN_CLIENT_ID');
  if (!env.ATLASSIAN_CLIENT_SECRET) missing.push('ATLASSIAN_CLIENT_SECRET');
  if (!env.ATLASSIAN_REDIRECT_URI) missing.push('ATLASSIAN_REDIRECT_URI');
  if (missing.length) {
    const error = new Error(`Missing Atlassian OAuth config: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
}

export function createAuthorizationRequest() {
  requireOAuthConfig();
  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: env.ATLASSIAN_CLIENT_ID,
    scope: env.ATLASSIAN_SCOPES,
    redirect_uri: env.ATLASSIAN_REDIRECT_URI,
    state,
    response_type: 'code',
    prompt: 'consent',
    code_challenge: base64UrlSha256(codeVerifier),
    code_challenge_method: 'S256',
  });
  return { state, codeVerifier, url: `${authorizeUrl}?${params.toString()}` };
}

export async function exchangeAuthorizationCode(code, codeVerifier) {
  requireOAuthConfig();
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: env.ATLASSIAN_CLIENT_ID,
      client_secret: env.ATLASSIAN_CLIENT_SECRET,
      code,
      redirect_uri: env.ATLASSIAN_REDIRECT_URI,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Atlassian token exchange failed: ${response.status}`);
  return response.json();
}

export async function fetchAtlassianProfile(accessToken) {
  const response = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Atlassian profile failed: ${response.status}`);
  return response.json();
}

export async function fetchAccessibleResources(accessToken) {
  const response = await fetch(resourcesUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Atlassian resources failed: ${response.status}`);
  return response.json();
}


export async function refreshAccessToken(refreshToken) {
  requireOAuthConfig();
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: env.ATLASSIAN_CLIENT_ID,
      client_secret: env.ATLASSIAN_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const error = new Error(`Atlassian token refresh failed: ${response.status}`);
    error.statusCode = response.status;
    error.code = 'ATLASSIAN_REFRESH_FAILED';
    throw error;
  }
  return response.json();
}
