import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { emitSessionExpired } from '../utils/authEvents';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../utils/tokenStorage';
import type { ApiEnvelope, Page, RefreshResponse } from '../types/api';
import { ApiError, toApiError } from './errors';

/** 10.0.2.2 is the Android emulator's alias for the host machine. */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api/v1';

export const client = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

client.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Single-flight refresh: the first 401 rotates the pair, every other request
 * that 401s meanwhile awaits the same promise. Parallel rotations would trip
 * the server's refresh-token reuse detection and revoke the whole session.
 */
let refreshPromise: Promise<string> | null = null;

async function rotateTokens(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored');

  // Bare axios — the instance's interceptors must not recurse into this call.
  const res = await axios.post<ApiEnvelope<RefreshResponse>>(`${BASE_URL}/auth/refresh`, {
    refreshToken,
  });

  const tokens = res.data?.data?.tokens;
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Malformed refresh response');
  }

  await saveTokens(tokens.accessToken, tokens.refreshToken);
  return tokens.accessToken;
}

/**
 * A 401 from these is the real answer, not an expired token. /auth/me is
 * deliberately absent — it is a normal call and should be retried like any other.
 */
const NON_REFRESHABLE = ['/auth/refresh', '/auth/login', '/auth/signup', '/auth/logout'];

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;
    const url = original?.url ?? '';
    const isNonRefreshable = NON_REFRESHABLE.some((path) => url.includes(path));

    if (error.response?.status === 401 && original && !original._retry && !isNonRefreshable) {
      original._retry = true;

      try {
        refreshPromise ??= rotateTokens().finally(() => {
          refreshPromise = null;
        });
        const accessToken = await refreshPromise;

        original.headers.Authorization = `Bearer ${accessToken}`;
        return await client(original);
      } catch {
        await clearTokens();
        emitSessionExpired();
      }
    }

    // Past this point the app only ever sees ApiError, never AxiosError.
    return Promise.reject(toApiError(error));
  },
);

/** Test seam — resets the module-level single-flight state between cases. */
export const __resetRefreshState = (): void => {
  refreshPromise = null;
};

// ─── Typed request helpers ───────────────────────────────────────────────────

/** Unwraps the envelope so callers receive `data` directly. */
async function unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await request;
  const envelope = response.data;

  if (!envelope?.success) {
    throw new ApiError({
      message: envelope?.error?.message ?? 'Request failed',
      code: envelope?.error?.code ?? 'UNKNOWN',
      fieldErrors: envelope?.error?.details ?? [],
      requestId: envelope?.meta?.requestId ?? null,
    });
  }

  return envelope.data;
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** Drops null/undefined so axios doesn't serialize `cursor=null` onto the URL. */
const clean = (params?: Params): Params | undefined => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  );
};

export const get = <T>(url: string, params?: Params): Promise<T> =>
  unwrap<T>(client.get<ApiEnvelope<T>>(url, { params: clean(params) }));

export const post = <T>(url: string, body?: unknown): Promise<T> =>
  unwrap<T>(client.post<ApiEnvelope<T>>(url, body));

export const del = <T>(url: string, body?: unknown): Promise<T> =>
  unwrap<T>(client.delete<ApiEnvelope<T>>(url, { data: body }));

/**
 * Rejoins a list response's rows (`data`) and cursor (`meta.pagination`) into
 * one object, which is what an infinite query needs per page.
 */
export async function getPage<T>(url: string, params?: Params): Promise<Page<T>> {
  const response = await client.get<ApiEnvelope<T[]>>(url, { params: clean(params) });
  const envelope = response.data;

  if (!envelope?.success) {
    throw new ApiError({
      message: envelope?.error?.message ?? 'Request failed',
      code: envelope?.error?.code ?? 'UNKNOWN',
    });
  }

  return {
    items: envelope.data,
    pagination: envelope.meta?.pagination ?? { nextCursor: null, hasMore: false, limit: 20 },
  };
}
