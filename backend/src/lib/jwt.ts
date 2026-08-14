import { createHash, randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export const signAccessToken = (userId: string): string =>
  jwt.sign({ sub: userId, type: 'access' } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });

export const signRefreshToken = (userId: string): { token: string; jti: string } => {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: userId, type: 'refresh', jti } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'] },
  );
  return { token, jti };
};

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;

/** Raw refresh tokens are never persisted — only their sha256 hash. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const TTL_UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  return Number(match[1]) * TTL_UNIT_MS[match[2]!]!;
}
