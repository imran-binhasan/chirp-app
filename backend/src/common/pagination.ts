import { z } from 'zod';
import { ValidationError } from './errors/app-error';

/**
 * Keyset pagination. The cursor is an opaque base64url token holding the
 * (createdAt, id) of the previous page's last row. Unlike OFFSET, it never
 * skips or repeats rows when new posts arrive mid-scroll.
 */

const cursorPayloadSchema = z.object({
  c: z.iso.datetime(),
  i: z.uuid(),
});

export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const { c, i } = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    );
    return { createdAt: new Date(c), id: i };
  } catch {
    throw new ValidationError('Invalid pagination cursor', [
      { field: 'cursor', message: 'Cursor is malformed' },
    ]);
  }
}

export const paginationQueryFields = {
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
};

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/** Rows strictly older than the cursor position. */
export function keysetWhere(rawCursor: string | undefined): {
  OR?: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }];
} {
  if (!rawCursor) return {};
  const cursor = decodeCursor(rawCursor);
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

/**
 * Splits a `limit + 1` query result into the page and its cursor metadata.
 * The extra row is how we know more exist without a COUNT(*).
 */
export function buildPagination<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { page: T[]; pagination: PaginationMeta } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    page,
    pagination: {
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
      hasMore,
      limit,
    },
  };
}
