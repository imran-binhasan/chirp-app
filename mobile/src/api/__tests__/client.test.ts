import axios from 'axios';
import { client, get, getPage, __resetRefreshState } from '../client';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../../utils/tokenStorage';
import { envelope, errorEnvelope, RouteStub } from './testAdapter';

/**
 * The refresh interceptor is where this app's worst bug lived: it read
 * `data.accessToken` when the API returns `data.tokens.accessToken`, so every
 * session died ~15 minutes after login. These tests pin that contract down.
 */

const tokenPair = (suffix: string) =>
  envelope({
    tokens: {
      accessToken: `access-${suffix}`,
      refreshToken: `refresh-${suffix}`,
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2592000,
    },
  });

let stub: RouteStub;
const originalClientAdapter = client.defaults.adapter;
const originalAxiosAdapter = axios.defaults.adapter;

beforeEach(async () => {
  stub = new RouteStub();
  // The instance and the bare axios used for rotation share one stub.
  client.defaults.adapter = stub.adapter;
  axios.defaults.adapter = stub.adapter;
  __resetRefreshState();
  await clearTokens();
  await saveTokens('access-old', 'refresh-old');
});

afterEach(() => {
  client.defaults.adapter = originalClientAdapter;
  axios.defaults.adapter = originalAxiosAdapter;
});

/** Responds 401 the first time a URL is hit, then 200. */
function failsOnceThenSucceeds(body: unknown = envelope([])) {
  let seen = 0;
  return (): [number, unknown] => {
    seen += 1;
    return seen === 1 ? [401, errorEnvelope('UNAUTHORIZED', 'Token expired')] : [200, body];
  };
}

describe('token refresh', () => {
  it('reads the access token from data.tokens, not data', async () => {
    stub
      .on('post', '/auth/refresh', () => [200, tokenPair('new')])
      .on('get', '/posts', failsOnceThenSucceeds(envelope([{ id: 'p1' }])));

    const response = await client.get('/posts');

    expect(response.status).toBe(200);
    // The rotated pair must actually persist — the bug stored `undefined`.
    expect(await getAccessToken()).toBe('access-new');
    expect(await getRefreshToken()).toBe('refresh-new');
  });

  it('retries the original request with the new bearer token', async () => {
    stub
      .on('post', '/auth/refresh', () => [200, tokenPair('new')])
      .on('get', '/posts', failsOnceThenSucceeds());

    await client.get('/posts');

    const postCalls = stub.requestsFor('/posts');
    expect(postCalls).toHaveLength(2);
    expect(postCalls[0].headers.Authorization).toBe('Bearer access-old');
    expect(postCalls[1].headers.Authorization).toBe('Bearer access-new');
  });

  it('rotates only once when several requests 401 together', async () => {
    // Parallel rotations replay a used refresh token, which the server treats
    // as theft and answers by revoking the whole session family.
    stub
      .on('post', '/auth/refresh', () => [200, tokenPair('new')])
      .on('get', '/posts', failsOnceThenSucceeds())
      .on('get', '/notifications', failsOnceThenSucceeds())
      .on('get', '/auth/me', failsOnceThenSucceeds(envelope({ id: 'u1' })));

    await Promise.all([
      client.get('/posts'),
      client.get('/notifications'),
      client.get('/auth/me'),
    ]);

    expect(stub.requestsFor('/auth/refresh')).toHaveLength(1);
  });

  it('clears tokens when the refresh token is rejected', async () => {
    stub
      .on('post', '/auth/refresh', () => [401, errorEnvelope('UNAUTHORIZED', 'Reuse detected')])
      .on('get', '/posts', () => [401, errorEnvelope('UNAUTHORIZED', 'Token expired')]);

    await expect(client.get('/posts')).rejects.toMatchObject({ name: 'ApiError' });

    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('treats a malformed refresh response as a failed refresh', async () => {
    // Exactly the old bug's shape: tokens nested where the client didn't look.
    stub
      .on('post', '/auth/refresh', () => [200, envelope({ accessToken: 'wrong-shape' })])
      .on('get', '/posts', () => [401, errorEnvelope('UNAUTHORIZED', 'Token expired')]);

    await expect(client.get('/posts')).rejects.toBeDefined();
    expect(await getAccessToken()).toBeNull();
  });

  it('never tries to refresh a failed login', async () => {
    stub
      .on('post', '/auth/refresh', () => [200, tokenPair('new')])
      .on('post', '/auth/login', () => [
        401,
        errorEnvelope('UNAUTHORIZED', 'Invalid credentials'),
      ]);

    await expect(client.post('/auth/login', {})).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
    expect(stub.requestsFor('/auth/refresh')).toHaveLength(0);
  });

  it('gives up after one retry instead of looping forever', async () => {
    stub
      .on('post', '/auth/refresh', () => [200, tokenPair('new')])
      .on('get', '/posts', () => [401, errorEnvelope('UNAUTHORIZED', 'Still expired')]);

    await expect(client.get('/posts')).rejects.toBeDefined();
    expect(stub.requestsFor('/posts')).toHaveLength(2); // original + one retry
  });

  it('attaches the stored bearer token to every request', async () => {
    stub.on('get', '/auth/me', () => [200, envelope({ id: 'u1', username: 'jane' })]);

    await client.get('/auth/me');

    expect(stub.requestsFor('/auth/me')[0].headers.Authorization).toBe('Bearer access-old');
  });
});

describe('request helpers', () => {
  it('unwraps the envelope so callers receive data directly', async () => {
    stub.on('get', '/auth/me', () => [200, envelope({ id: 'u1', username: 'jane' })]);

    await expect(get('/auth/me')).resolves.toEqual({ id: 'u1', username: 'jane' });
  });

  it('throws an ApiError on a success:false body with a 200 status', async () => {
    stub.on('get', '/posts', () => [200, errorEnvelope('CONFLICT', 'Nope')]);

    await expect(get('/posts')).rejects.toMatchObject({ code: 'CONFLICT', message: 'Nope' });
  });

  it('rejoins rows and pagination into one page object', async () => {
    stub.on('get', '/posts', () => [
      200,
      envelope([{ id: 'p1' }, { id: 'p2' }], { nextCursor: 'abc', hasMore: true, limit: 20 }),
    ]);

    const page = await getPage('/posts');

    expect(page.items).toHaveLength(2);
    expect(page.pagination).toEqual({ nextCursor: 'abc', hasMore: true, limit: 20 });
  });

  it('defaults pagination when the endpoint omits it', async () => {
    stub.on('get', '/posts', () => [200, envelope([])]);

    const page = await getPage('/posts');

    expect(page.pagination.hasMore).toBe(false);
    expect(page.pagination.nextCursor).toBeNull();
  });

  it('drops null params instead of sending cursor=null', async () => {
    stub.on('get', '/posts', () => [200, envelope([])]);

    await getPage('/posts', { cursor: null, limit: 20 });

    const params = stub.requestsFor('/posts')[0].params ?? {};
    expect(params).not.toHaveProperty('cursor');
    expect(params).toHaveProperty('limit', 20);
  });
});
