import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, authHeader, createTestPost, createTestUser, resetDatabase } from './helpers';

describe('Interactions (likes & comments)', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  describe('POST /posts/:id/like', () => {
    it('toggles like state and keeps the counter authoritative', async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);

      const liked = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set(authHeader(fan.accessToken))
        .expect(200);
      expect(liked.body.data).toMatchObject({ liked: true, likeCount: 1 });

      const unliked = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set(authHeader(fan.accessToken))
        .expect(200);
      expect(unliked.body.data).toMatchObject({ liked: false, likeCount: 0 });
    });

    it('reflects likedByMe per viewer in the feed', async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);

      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

      const fanFeed = await request(app)
        .get('/api/v1/posts')
        .set(authHeader(fan.accessToken))
        .expect(200);
      expect(fanFeed.body.data[0].likedByMe).toBe(true);
      expect(fanFeed.body.data[0].likeCount).toBe(1);

      const authorFeed = await request(app)
        .get('/api/v1/posts')
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(authorFeed.body.data[0].likedByMe).toBe(false);
    });

    it('stores at most one like row per user per post (db-level idempotency)', async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);

      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

      const likeRows = await prisma.like.count({ where: { postId } });
      expect(likeRows).toBe(1);
    });

    it('returns 404 for a missing post', async () => {
      const user = await createTestUser('janedoe');
      await request(app)
        .post('/api/v1/posts/3f6b9c2e-7d21-4c5f-9a1b-2c3d4e5f6a7b/like')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });

  describe('POST /posts/:id/comments', () => {
    it('creates a comment and increments the post counter', async () => {
      const author = await createTestUser('janedoe');
      const commenter = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(authHeader(commenter.accessToken))
        .send({ content: 'Nice post!' })
        .expect(201);
      expect(res.body.data.author.username).toBe('johnsmith');
      expect(res.body.data.postId).toBe(postId);

      const post = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(post.body.data.commentCount).toBe(1);
    });

    it('rejects empty and over-length comments', async () => {
      const user = await createTestUser('janedoe');
      const postId = await createTestPost(user.accessToken);

      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(authHeader(user.accessToken))
        .send({ content: '   ' })
        .expect(400);

      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(authHeader(user.accessToken))
        .send({ content: 'x'.repeat(1001) })
        .expect(400);
    });

    it('returns 404 when commenting on a missing post', async () => {
      const user = await createTestUser('janedoe');
      await request(app)
        .post('/api/v1/posts/3f6b9c2e-7d21-4c5f-9a1b-2c3d4e5f6a7b/comments')
        .set(authHeader(user.accessToken))
        .send({ content: 'hello' })
        .expect(404);
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('returns comments newest-first with working cursor pagination', async () => {
      const user = await createTestUser('janedoe');
      const postId = await createTestPost(user.accessToken);

      const commentIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post(`/api/v1/posts/${postId}/comments`)
          .set(authHeader(user.accessToken))
          .send({ content: `comment ${i}` })
          .expect(201);
        commentIds.unshift(res.body.data.id); // newest-first expectation
      }

      const page1 = await request(app)
        .get(`/api/v1/posts/${postId}/comments?limit=2`)
        .set(authHeader(user.accessToken))
        .expect(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta.pagination.hasMore).toBe(true);

      const page2 = await request(app)
        .get(`/api/v1/posts/${postId}/comments?limit=2&cursor=${page1.body.meta.pagination.nextCursor}`)
        .set(authHeader(user.accessToken))
        .expect(200);
      const page3 = await request(app)
        .get(`/api/v1/posts/${postId}/comments?limit=2&cursor=${page2.body.meta.pagination.nextCursor}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      const all = [...page1.body.data, ...page2.body.data, ...page3.body.data].map(
        (c: { id: string }) => c.id,
      );
      expect(all).toEqual(commentIds);
    });

    it('returns 404 for comments of a missing post', async () => {
      const user = await createTestUser('janedoe');
      await request(app)
        .get('/api/v1/posts/3f6b9c2e-7d21-4c5f-9a1b-2c3d4e5f6a7b/comments')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });
});
