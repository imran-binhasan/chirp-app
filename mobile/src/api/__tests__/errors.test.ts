import { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, errorMessage, toApiError } from '../errors';

/** Builds an AxiosError shaped like a real response from our API. */
function axiosErrorWith(status: number, body: unknown): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    statusText: '',
    data: body,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

const envelope = (code: string, message: string, details?: unknown) => ({
  success: false,
  data: null,
  error: { code, message, ...(details ? { details } : {}) },
  meta: { requestId: 'req-123', timestamp: '2026-08-14T00:00:00.000Z' },
});

describe('toApiError', () => {
  it('maps a missing response to a network error', () => {
    const error = toApiError(new AxiosError('Network Error'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toMatch(/connection/i);
    expect(error.isRetryable).toBe(true);
  });

  it('surfaces server-authored 4xx messages verbatim', () => {
    // These are written for end users — "Username is already taken" is exactly
    // what we want on screen, so it must not be replaced by a generic string.
    const error = toApiError(
      axiosErrorWith(409, envelope('CONFLICT', 'Username is already taken')),
    );

    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Username is already taken');
    expect(error.status).toBe(409);
  });

  it('replaces 5xx messages, which may leak internals', () => {
    const error = toApiError(
      axiosErrorWith(500, envelope('INTERNAL_ERROR', 'ECONNREFUSED at pg pool 10.0.0.4:5432')),
    );

    expect(error.message).not.toMatch(/ECONNREFUSED/);
    expect(error.message).toMatch(/try again/i);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('keeps field-level validation details addressable', () => {
    const error = toApiError(
      axiosErrorWith(
        400,
        envelope('VALIDATION_ERROR', 'Request validation failed', [
          { field: 'email', message: 'Invalid email address' },
          { field: 'password', message: 'Password must be at least 8 characters' },
        ]),
      ),
    );

    expect(error.fieldErrors).toHaveLength(2);
    expect(error.fieldError('email')).toBe('Invalid email address');
    expect(error.fieldError('password')).toMatch(/at least 8/);
    expect(error.fieldError('username')).toBeUndefined();
  });

  it('captures the requestId so a user can quote it in a bug report', () => {
    const error = toApiError(axiosErrorWith(404, envelope('NOT_FOUND', 'Post not found')));
    expect(error.requestId).toBe('req-123');
  });

  it('flags 401 as an auth failure', () => {
    const error = toApiError(axiosErrorWith(401, envelope('UNAUTHORIZED', 'Invalid credentials')));
    expect(error.isAuthFailure).toBe(true);
  });

  it('falls back to a status-derived code when the body is unusable', () => {
    const error = toApiError(axiosErrorWith(429, 'not json at all'));
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message).toMatch(/wait a moment/i);
    expect(error.isRetryable).toBe(true);
  });

  it('passes an existing ApiError straight through', () => {
    const original = new ApiError({ message: 'already normalized', code: 'CONFLICT' });
    expect(toApiError(original)).toBe(original);
  });

  it('handles values that are not errors at all', () => {
    const error = toApiError('a bare string');
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBeTruthy();
  });
});

describe('errorMessage', () => {
  it('always yields a displayable string', () => {
    expect(typeof errorMessage(new Error('boom'))).toBe('string');
    expect(typeof errorMessage(undefined)).toBe('string');
    expect(errorMessage(undefined).length).toBeGreaterThan(0);
  });
});
