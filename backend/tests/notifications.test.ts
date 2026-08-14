import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, authHeader, createTestPost, createTestUser, resetDatabase } from './helpers';

describe('Notifications', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('records a notification when someone else likes or comments', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);

    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));
    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(fan.accessToken))
      .send({ content: 'Nice!' });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);

    const types = res.body.data.map((n: { type: string }) => n.type);
    expect(types).toEqual(['POST_COMMENTED', 'POST_LIKED']); // newest first
    expect(res.body.data[0].actor.username).toBe('johnsmith');
    expect(res.body.data[0].postId).toBe(postId);
  });

  it('never notifies you about your own actions', async () => {
    const author = await createTestUser('janedoe');
    const postId = await createTestPost(author.accessToken);

    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(author.accessToken));
    await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(author.accessToken))
      .send({ content: 'talking to myself' });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('unliking does not generate a second notification', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);

    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));
    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('does not re-announce a like the author was already told about', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);

    // like → unlike → like. A like is a state, not an event: toggling the
    // heart must not be a way to spam someone's inbox.
    for (const liked of [true, false, true]) {
      await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set(authHeader(fan.accessToken))
        .send({ liked })
        .expect(200);
    }

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('still records one notification per comment', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);

    for (const content of ['first', 'second']) {
      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(authHeader(fan.accessToken))
        .send({ content })
        .expect(201);
    }

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(2);
  });

  describe('POST /notifications/:id/read', () => {
    it('marks a single notification read and leaves the rest alone', async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);
      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));
      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set(authHeader(fan.accessToken))
        .send({ content: 'Nice!' });

      const inbox = await request(app)
        .get('/api/v1/notifications')
        .set(authHeader(author.accessToken))
        .expect(200);
      const target = inbox.body.data[0].id;

      const marked = await request(app)
        .post(`/api/v1/notifications/${target}/read`)
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(marked.body.data.updated).toBe(1);

      const after = await request(app)
        .get('/api/v1/notifications')
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(after.body.data.find((n: { id: string }) => n.id === target).read).toBe(true);

      const unread = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(unread.body.data.unread).toBe(1);
    });

    it('is idempotent — a second call reports nothing updated', async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);
      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

      const inbox = await request(app)
        .get('/api/v1/notifications')
        .set(authHeader(author.accessToken));
      const target = inbox.body.data[0].id;

      await request(app)
        .post(`/api/v1/notifications/${target}/read`)
        .set(authHeader(author.accessToken))
        .expect(200);
      const second = await request(app)
        .post(`/api/v1/notifications/${target}/read`)
        .set(authHeader(author.accessToken))
        .expect(200);
      expect(second.body.data.updated).toBe(0);
    });

    it("refuses to touch someone else's notification", async () => {
      const author = await createTestUser('janedoe');
      const fan = await createTestUser('johnsmith');
      const postId = await createTestPost(author.accessToken);
      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

      const inbox = await request(app)
        .get('/api/v1/notifications')
        .set(authHeader(author.accessToken));
      const target = inbox.body.data[0].id;

      // The fan knows the id but the row is not theirs — silently a no-op,
      // which also avoids confirming that the id exists.
      const res = await request(app)
        .post(`/api/v1/notifications/${target}/read`)
        .set(authHeader(fan.accessToken))
        .expect(200);
      expect(res.body.data.updated).toBe(0);

      const stillUnread = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set(authHeader(author.accessToken));
      expect(stillUnread.body.data.unread).toBe(1);
    });

    it('rejects a non-uuid id', async () => {
      const user = await createTestUser('janedoe');
      await request(app)
        .post('/api/v1/notifications/not-a-uuid/read')
        .set(authHeader(user.accessToken))
        .expect(400);
    });
  });

  it('reading the inbox does not mark it read — that needs an explicit POST', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);
    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

    const first = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(first.body.data[0].read).toBe(false);

    const count = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(count.body.data.unread).toBe(1);

    await request(app)
      .post('/api/v1/notifications/read')
      .set(authHeader(author.accessToken))
      .expect(200);

    const after = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(after.body.data[0].read).toBe(true);

    const zero = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(zero.body.data.unread).toBe(0);
  });

  it('paginates with a working cursor and never repeats a page', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');

    for (let i = 0; i < 5; i++) {
      const postId = await createTestPost(author.accessToken, `post ${i}`);
      await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));
    }

    const page1 = await request(app)
      .get('/api/v1/notifications?limit=2')
      .set(authHeader(author.accessToken))
      .expect(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.pagination.hasMore).toBe(true);

    const page2 = await request(app)
      .get(`/api/v1/notifications?limit=2&cursor=${page1.body.meta.pagination.nextCursor}`)
      .set(authHeader(author.accessToken))
      .expect(200);

    const ids = [...page1.body.data, ...page2.body.data].map((n: { id: string }) => n.id);
    expect(new Set(ids).size).toBe(4); // no overlap between pages
  });

  it('only ever shows you your own notifications', async () => {
    const author = await createTestUser('janedoe');
    const fan = await createTestUser('johnsmith');
    const postId = await createTestPost(author.accessToken);
    await request(app).post(`/api/v1/posts/${postId}/like`).set(authHeader(fan.accessToken));

    const res = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(fan.accessToken))
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/notifications').expect(401);
    await request(app).post('/api/v1/notifications/read').expect(401);
  });
});
