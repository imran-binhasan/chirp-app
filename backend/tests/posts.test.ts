import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, authHeader, createTestPost, createTestUser, resetDatabase } from './helpers';

describe('Posts', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('POST /posts', () => {
    it('creates a post with embedded author and zeroed counters', async () => {
      const user = await createTestUser('janedoe');
      const res = await request(app)
        .post('/api/v1/posts')
        .set(authHeader(user.accessToken))
        .send({ content: '  Hello world!  ' })
        .expect(201);

      expect(res.body.data.content).toBe('Hello world!'); // trimmed by validation
      expect(res.body.data.author.username).toBe('janedoe');
      expect(res.body.data.likeCount).toBe(0);
      expect(res.body.data.commentCount).toBe(0);
      expect(res.body.data.likedByMe).toBe(false);
    });

    it('rejects empty and over-length content', async () => {
      const user = await createTestUser('janedoe');

      await request(app)
        .post('/api/v1/posts')
        .set(authHeader(user.accessToken))
        .send({ content: '   ' })
        .expect(400);

      await request(app)
        .post('/api/v1/posts')
        .set(authHeader(user.accessToken))
        .send({ content: 'x'.repeat(2001) })
        .expect(400);

      // Boundary: exactly 2000 chars is allowed.
      await request(app)
        .post('/api/v1/posts')
        .set(authHeader(user.accessToken))
        .send({ content: 'x'.repeat(2000) })
        .expect(201);
    });

    it('requires authentication', async () => {
      await request(app).post('/api/v1/posts').send({ content: 'hi' }).expect(401);
    });
  });

  describe('GET /posts', () => {
    it('returns posts newest-first', async () => {
      const user = await createTestUser('janedoe');
      const first = await createTestPost(user.accessToken, 'first');
      const second = await createTestPost(user.accessToken, 'second');

      const res = await request(app)
        .get('/api/v1/posts')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([second, first]);
      expect(res.body.meta.pagination.hasMore).toBe(false);
      expect(res.body.meta.pagination.nextCursor).toBeNull();
    });

    it('paginates with a stable cursor — no overlaps, no missing rows', async () => {
      const user = await createTestUser('janedoe');
      const ids: string[] = [];
      for (let i = 1; i <= 25; i++) {
        ids.unshift(await createTestPost(user.accessToken, `post ${i}`)); // newest-first order
      }

      const page1 = await request(app)
        .get('/api/v1/posts?limit=10')
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.meta.pagination.hasMore).toBe(true);

      const page2 = await request(app)
        .get(`/api/v1/posts?limit=10&cursor=${page1.body.meta.pagination.nextCursor}`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(page2.body.data).toHaveLength(10);

      const page3 = await request(app)
        .get(`/api/v1/posts?limit=10&cursor=${page2.body.meta.pagination.nextCursor}`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(page3.body.data).toHaveLength(5);
      expect(page3.body.meta.pagination.hasMore).toBe(false);

      const seen = [...page1.body.data, ...page2.body.data, ...page3.body.data].map(
        (p: { id: string }) => p.id,
      );
      expect(seen).toEqual(ids);
      expect(new Set(seen).size).toBe(25);
    });

    it('filters the feed by username', async () => {
      const jane = await createTestUser('janedoe');
      const john = await createTestUser('johnsmith');
      await createTestPost(jane.accessToken, 'jane 1');
      await createTestPost(jane.accessToken, 'jane 2');
      await createTestPost(john.accessToken, 'john 1');

      const res = await request(app)
        .get('/api/v1/posts?username=JANEDOE') // case-insensitive
        .set(authHeader(john.accessToken))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      for (const post of res.body.data) {
        expect(post.author.username).toBe('janedoe');
      }

      const empty = await request(app)
        .get('/api/v1/posts?username=nobody')
        .set(authHeader(john.accessToken))
        .expect(200);
      expect(empty.body.data).toEqual([]);
    });

    it('rejects a malformed cursor with 400', async () => {
      const user = await createTestUser('janedoe');
      const res = await request(app)
        .get('/api/v1/posts?cursor=not-a-cursor')
        .set(authHeader(user.accessToken))
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /posts/:id', () => {
    it('returns the post or 404', async () => {
      const user = await createTestUser('janedoe');
      const postId = await createTestPost(user.accessToken);

      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(res.body.data.id).toBe(postId);

      const missing = await request(app)
        .get('/api/v1/posts/3f6b9c2e-7d21-4c5f-9a1b-2c3d4e5f6a7b')
        .set(authHeader(user.accessToken))
        .expect(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');

      await request(app).get('/api/v1/posts/not-a-uuid').set(authHeader(user.accessToken)).expect(400);
    });
  });
});
