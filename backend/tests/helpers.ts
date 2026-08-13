import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

/** Truncates every table — called before each test for full isolation. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.deviceToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.like.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export interface TestUser {
  id: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

export async function createTestUser(
  username: string,
  email = `${username}@example.com`,
): Promise<TestUser> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ username, email, password: 'password1' })
    .expect(201);
  return {
    id: res.body.data.user.id,
    username,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken: res.body.data.tokens.refreshToken,
  };
}

export const authHeader = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

export async function createTestPost(accessToken: string, content = 'Test post'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/posts')
    .set(authHeader(accessToken))
    .send({ content })
    .expect(201);
  return res.body.data.id as string;
}
