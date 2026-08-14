import axios from 'axios';
import type { ApiErrorBody, ApiErrorCode, FieldError } from '../types/api';

/**
 * The only error type the app deals with. Screens never inspect axios errors,
 * status codes or response bodies, and `message` is always safe to display.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly fieldErrors: FieldError[];
  readonly requestId: string | null;

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    status?: number | null;
    fieldErrors?: FieldError[];
    requestId?: string | null;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status ?? null;
    this.fieldErrors = params.fieldErrors ?? [];
    this.requestId = params.requestId ?? null;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'RATE_LIMITED' || this.status === 500;
  }

  /** True when the session is gone and the user must sign in again. */
  get isAuthFailure(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  /** First message for a given form field, if the server rejected it. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }
}

/** Shown when the server supplied nothing worth surfacing. */
const FALLBACK_MESSAGE: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  BAD_JSON: 'Something went wrong sending that request. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: 'That already exists. Try a different value.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'The server ran into a problem. Please try again shortly.',
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
  UNKNOWN: 'Something went wrong. Please try again.',
};

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' && value !== null && 'code' in value && 'message' in value;

/**
 * 4xx messages are shown as-is: the backend writes them for end users
 * ("Username is already taken"). 5xx messages are replaced — they mean nothing
 * to a person and may leak internals.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiError({
        message: FALLBACK_MESSAGE.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
      });
    }

    const { status, data } = error.response;
    const body = (data ?? {}) as { error?: unknown; meta?: { requestId?: string } };
    const serverError = isApiErrorBody(body.error) ? body.error : null;

    const code: ApiErrorCode = serverError?.code ?? STATUS_TO_CODE[status] ?? 'UNKNOWN';
    const trustServerMessage = status < 500 && Boolean(serverError?.message);

    return new ApiError({
      message: trustServerMessage
        ? (serverError as ApiErrorBody).message
        : (FALLBACK_MESSAGE[code] ?? FALLBACK_MESSAGE.UNKNOWN),
      code,
      status,
      fieldErrors: serverError?.details ?? [],
      requestId: body.meta?.requestId ?? null,
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : FALLBACK_MESSAGE.UNKNOWN,
    code: 'UNKNOWN',
  });
}

/** Safe accessor for anything that reaches a UI error slot. */
export const errorMessage = (error: unknown): string => toApiError(error).message;
