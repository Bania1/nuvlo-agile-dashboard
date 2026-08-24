export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';

let csrfTokenPromise;

function readCookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || null;
}

async function getCsrfToken() {
  const cookieToken = readCookie('nuvlo_csrf');
  if (cookieToken) return cookieToken;
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchJson('/api/auth/csrf').finally(() => {
      csrfTokenPromise = null;
    });
  }
  const payload = await csrfTokenPromise;
  return payload.csrfToken;
}

export async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `HTTP_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function sendJson(path, method, body) {
  const csrfToken = await getCsrfToken();
  return fetchJson(path, {
    method,
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(body || {}),
  });
}

export async function postJson(path, body) {
  return sendJson(path, 'POST', body);
}

export async function patchJson(path, body) {
  return sendJson(path, 'PATCH', body);
}

export async function deleteJson(path) {
  const csrfToken = await getCsrfToken();
  return fetchJson(path, {
    method: 'DELETE',
    headers: { 'x-csrf-token': csrfToken },
  });
}
