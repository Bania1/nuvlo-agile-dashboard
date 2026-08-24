import { describe, expect, it, vi } from 'vitest';
import { csrfRequired } from './csrf.js';

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('csrf middleware', () => {
  it('rejects missing csrf token', () => {
    const response = mockResponse();
    const next = vi.fn();

    csrfRequired({ cookies: {}, get: () => null }, response, next);

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts matching cookie and header tokens', () => {
    const response = mockResponse();
    const next = vi.fn();

    csrfRequired({ cookies: { nuvlo_csrf: 'token-123' }, get: () => 'token-123' }, response, next);

    expect(response.statusCode).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });
});
