import { env } from '../../config/env';
import { Prisma } from '@prisma/client';
import { hashToken, signAccessToken, signRefreshToken, ttlToMs, verifyRefreshToken } from '../../lib/jwt';
import { hashPassword, verifyPassword, wasteVerificationTime } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { ConflictError, UnauthorizedError } from '../../common/errors/app-error';
import { userSelfSelect } from '../users/user.select';
import type { LoginInput, SignupInput } from './auth.validation';

/** Usernames/emails are stored lowercase so lookups are case-insensitive. */
const normalize = (value: string): string => value.trim().toLowerCase();

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

async function issueTokenPair(userId: string, db: DatabaseClient = prisma) {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken } = signRefreshToken(userId);

  const record = await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL)),
    },
    select: { id: true },
  });

  return {
    tokens: {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: ttlToMs(env.JWT_ACCESS_TTL) / 1000,
      refreshTokenExpiresIn: ttlToMs(env.JWT_REFRESH_TTL) / 1000,
    },
    refreshTokenId: record.id,
  };
}

/**
 * Names the field that actually collided. The pre-check in signup cannot be
 * authoritative — two concurrent requests can both pass it — so the database
 * has the last word, and the client still learns which field to fix.
 */
function conflictForUniqueViolation(error: unknown): ConflictError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.['target'];
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return fields.some((field) => field.includes('email'))
    ? new ConflictError('Email is already registered')
    : new ConflictError('Username is already taken');
}

export async function signup(input: SignupInput) {
  const username = normalize(input.username);
  const email = normalize(input.email);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (existing?.username === username) throw new ConflictError('Username is already taken');
  if (existing?.email === email) throw new ConflictError('Email is already registered');

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: userSelfSelect,
    });
  } catch (error) {
    const conflict = conflictForUniqueViolation(error);
    if (conflict) throw conflict;
    throw error;
  }

  const { tokens } = await issueTokenPair(user.id);
  return { user, tokens };
}

export async function login(input: LoginInput) {
  const identifier = normalize(input.identifier);

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { ...userSelfSelect, passwordHash: true },
  });

  // Same message and same wall-clock cost either way, so neither the wording
  // nor the timing reveals whether the account exists.
  if (!user) {
    await wasteVerificationTime();
    throw new UnauthorizedError('Invalid credentials');
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) throw new UnauthorizedError('Invalid credentials');

  const { passwordHash: _ignored, ...publicUser } = user;
  const { tokens } = await issueTokenPair(user.id);
  return { user: publicUser, tokens };
}

/**
 * Rotation: each call mints a new pair and revokes the old token. Presenting
 * an already-rotated token signals theft and revokes every session the user
 * has (OWASP refresh-token guidance).
 */
export async function refresh(refreshToken: string) {
  let userId: string;
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.type !== 'refresh') throw new Error('Unexpected token type');
    userId = payload.sub;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);

  // The outcome is returned, not thrown: throwing inside $transaction rolls it
  // back, which would undo the family revocation below and leave the stolen
  // session alive despite the 401 claiming otherwise.
  const outcome = await prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.userId !== userId || stored.expiresAt < new Date()) {
      return { status: 'invalid' as const };
    }

    // Compare-and-swap: two requests may both read an active token, but only
    // one may consume it. The loser is treated as a reuse signal.
    const consumed = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gte: new Date() } },
      data: { revokedAt: new Date() },
    });

    if (consumed.count !== 1) {
      return { status: 'reused' as const, userId: stored.userId };
    }

    const { tokens, refreshTokenId } = await issueTokenPair(stored.userId, tx);
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { replacedById: refreshTokenId },
    });
    return { status: 'rotated' as const, tokens };
  });

  if (outcome.status === 'invalid') {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (outcome.status === 'reused') {
    await prisma.refreshToken.updateMany({
      where: { userId: outcome.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reuse detected — all sessions have been revoked');
  }

  return { tokens: outcome.tokens };
}

/** Idempotent: logging out must never fail. */
export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelfSelect });
  if (!user) throw new UnauthorizedError('Account no longer exists');
  return user;
}
