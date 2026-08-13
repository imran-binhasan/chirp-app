import { AxiosError, type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from 'axios';

/**
 * Minimal request stubbing through axios's own adapter seam.
 *
 * Avoids pulling in axios-mock-adapter, which cannot install here because of a
 * pre-existing react/react-dom peer mismatch in the Expo dependency tree.
 */

export interface StubbedRequest {
  method: string;
  url: string;
  headers: Record<string, unknown>;
  params?: Record<string, unknown>;
  data?: unknown;
}

type Responder = (request: StubbedRequest) => [number, unknown];

export class RouteStub {
  readonly requests: StubbedRequest[] = [];
  private routes: { match: (req: StubbedRequest) => boolean; respond: Responder }[] = [];

  /** `url` matches when the request URL contains it. */
  on(method: string, url: string, respond: Responder): this {
    this.routes.push({
      match: (req) =>
        req.method.toLowerCase() === method.toLowerCase() && (req.url ?? '').includes(url),
      respond,
    });
    return this;
  }

  get adapter(): AxiosAdapter {
    return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      // config.headers is an AxiosHeaders instance — flatten it to a plain
      // object so assertions can read `headers.Authorization` directly.
      const rawHeaders = config.headers as unknown;
      const headers =
        rawHeaders && typeof (rawHeaders as { toJSON?: unknown }).toJSON === 'function'
          ? ((rawHeaders as { toJSON: () => Record<string, unknown> }).toJSON())
          : ((rawHeaders ?? {}) as Record<string, unknown>);

      const request: StubbedRequest = {
        method: config.method ?? 'get',
        url: config.url ?? '',
        headers,
        params: config.params as Record<string, unknown> | undefined,
        data: config.data,
      };
      this.requests.push(request);

      const route = this.routes.find((candidate) => candidate.match(request));
      if (!route) {
        throw new AxiosError(`No stub for ${request.method.toUpperCase()} ${request.url}`);
      }

      const [status, data] = route.respond(request);
      const response = {
        data,
        status,
        statusText: '',
        headers: {},
        config,
      } as AxiosResponse;

      if (status >= 200 && status < 300) return response;

      const error = new AxiosError(`Request failed with status ${status}`);
      error.response = response;
      error.config = config as AxiosError['config'];
      throw error;
    };
  }

  /** Requests recorded for a given URL fragment, in order. */
  requestsFor(urlFragment: string): StubbedRequest[] {
    return this.requests.filter((req) => (req.url ?? '').includes(urlFragment));
  }
}

export const envelope = <T>(data: T, pagination?: unknown) => ({
  success: true,
  data,
  error: null,
  meta: {
    requestId: 'req-test',
    timestamp: '2026-08-14T00:00:00.000Z',
    ...(pagination ? { pagination } : {}),
  },
});

export const errorEnvelope = (code: string, message: string, details?: unknown) => ({
  success: false,
  data: null,
  error: { code, message, ...(details ? { details } : {}) },
  meta: { requestId: 'req-test', timestamp: '2026-08-14T00:00:00.000Z' },
});
