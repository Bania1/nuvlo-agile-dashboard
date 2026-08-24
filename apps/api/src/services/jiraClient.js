const maxRetries = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(8000, 500 * 2 ** attempt) + jitter;
}

async function readErrorBody(response) {
  const text = await response.text().catch(() => '');
  return text ? text.slice(0, 500) : '';
}

export async function jiraRequest({ cloudId, accessToken, path, searchParams, method = 'GET', body, api = 'platform' }) {
  const apiPrefix = api === 'agile' ? '/rest/agile/1.0' : '/rest/api/3';
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}${apiPrefix}${path}`);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') url.searchParams.append(key, item);
      }
    } else if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 429 && attempt < maxRetries) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (!response.ok) {
      const responseBody = await readErrorBody(response);
      const error = new Error(`Jira request failed: ${response.status} ${api}${path}`);
      error.statusCode = response.status;
      error.code = 'JIRA_REQUEST_FAILED';
      error.api = api;
      error.path = path;
      error.responseBody = responseBody;
      error.rateLimitReason = response.headers.get('ratelimit-reason');
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }
  throw new Error('Jira request exhausted retries.');
}
