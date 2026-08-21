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

export async function jiraRequest({ cloudId, accessToken, path, searchParams }) {
  const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3${path}`);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (response.status === 429 && attempt < maxRetries) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (!response.ok) {
      const error = new Error(`Jira request failed: ${response.status}`);
      error.statusCode = response.status;
      error.rateLimitReason = response.headers.get('ratelimit-reason');
      throw error;
    }
    return response.json();
  }
  throw new Error('Jira request exhausted retries.');
}
