import { env } from '../../config/env';
import { hashToken, signAccessToken, signRefreshToken, ttlToMs, verifyRefreshToken } from '../../lib/jwt';
import { hashPassword, verifyPassword, wasteVerificationTime } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { ConflictError, UnauthorizedError } from '../../common/errors/app-error';
import { userSelfSelect } from '../users/user.select';
import type { LoginInput, SignupInput } from './auth.validation';

/** Usernames/emails are stored lowercase so lookups are case-insensitive. */
const normalize = (value: string): string => value.trim().toLowerCase();

async function issueTokenPair(userId: string) {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken } = signRefreshToken(userId);

  const record = await prisma.refreshToken.create({
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

export async function signup(input: SignupInput) {
  const username = normalize(input.username);
  const email = normalize(input.email);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (existing?.username === username) throw new ConflictError('Username is already taken');
  if (existing?.email === email) throw new ConflictError('Email is already registered');

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hashPassword(input.password),
    },
    select: userSelfSelect,
  });

  const { tokens } = await issueTokenPair(user.id);
  return { user, tokens };
}

export async function login(input: LoginInput) {
  const identifier = normalize(input.identifier);

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { ...userSelfSelect, passwordHash: true },
  });

  // Generic message on purpose — never reveal which part failed (user enumeration).
  // The dummy verify keeps both failure paths equal in time as well as in wording.
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
 * Refresh token rotation: every call issues a new pair and revokes the old
 * token. If an already-rotated token is presented again (theft signal), the
 * user's entire session family is revoked (OWASP refresh-token guidance).
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

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (!stored || stored.userId !== userId) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reuse detected — all sessions have been revoked');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired');
  }

  const { tokens, refreshTokenId } = await issueTokenPair(stored.userId);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedById: refreshTokenId },
  });

  return { tokens };
}

/** Idempotent by design — logging out must never fail. */
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
