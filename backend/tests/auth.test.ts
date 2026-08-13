import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, authHeader, createTestUser, resetDatabase } from './helpers';

describe('Auth', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('POST /auth/signup', () => {
    it('creates an account and returns the wrapped user + token pair', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          username: 'JaneDoe',
          email: 'Jane@Example.com',
          password: 'password1',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.error).toBeNull();
      expect(res.body.meta.requestId).toBeDefined();
      // Username/email are normalized to lowercase.
      expect(res.body.data.user.username).toBe('janedoe');
      expect(res.body.data.user.email).toBe('jane@example.com');
      // Password material must never leak.
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('$argon2');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.tokens.accessTokenExpiresIn).toBe(900);
    });

    it('rejects duplicate username with 409 CONFLICT', async () => {
      await createTestUser('janedoe');
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ username: 'JANEDOE', email: 'other@example.com', password: 'password1' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects duplicate email with 409 CONFLICT', async () => {
      await createTestUser('janedoe', 'jane@example.com');
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ username: 'someoneelse', email: 'jane@example.com', password: 'password1' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects invalid payloads with field-level details', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ username: 'ab', email: 'not-an-email', password: 'short' })
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('username');
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with email OR username (case-insensitive)', async () => {
      await createTestUser('janedoe', 'jane@example.com');

      const byEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'JANE@EXAMPLE.COM', password: 'password1' })
        .expect(200);
      expect(byEmail.body.data.user.username).toBe('janedoe');

      const byUsername = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'JaneDoe', password: 'password1' })
        .expect(200);
      expect(byUsername.body.data.tokens.accessToken).toBeDefined();
    });

    it('returns a generic 401 for wrong credentials (no enumeration)', async () => {
      await createTestUser('janedoe');

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'janedoe', password: 'wrongpass1' })
        .expect(401);
      const unknownUser = await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'ghost', password: 'password1' })
        .expect(401);

      expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
      expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the pair and rejects the old refresh token afterwards', async () => {
      const user = await createTestUser('janedoe');

      const rotated = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      const newPair = rotated.body.data.tokens;
      expect(newPair.accessToken).toBeDefined();
      expect(newPair.refreshToken).not.toBe(user.refreshToken);

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('detects reuse of a rotated token and revokes the whole session family', async () => {
      const user = await createTestUser('janedoe');
      const rotated = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      const stolenOldToken = user.refreshToken;
      const legitNewToken = rotated.body.data.tokens.refreshToken;

      // Attacker replays the old token → entire family must die.
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: stolenOldToken })
        .expect(401);

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: legitNewToken })
        .expect(401);
    });

    it('rejects access tokens presented as refresh tokens', async () => {
      const user = await createTestUser('janedoe');
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.accessToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token and is idempotent', async () => {
      const user = await createTestUser('janedoe');

      await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(
        (await request(app).post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken }))
          .status,
      ).toBe(200);

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user with a valid token, 401 without', async () => {
      const user = await createTestUser('janedoe');

      const res = await request(app).get('/api/v1/auth/me').set(authHeader(user.accessToken)).expect(200);
      expect(res.body.data.username).toBe('janedoe');

      await request(app).get('/api/v1/auth/me').expect(401);
    });
  });
});
