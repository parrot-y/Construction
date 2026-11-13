import type { FastifyRequest } from 'fastify';

/**
 * List pagination (staging hardening): every collection endpoint accepts
 * `?page=` (1-based, default 1) and `?limit=` (default 50, max 200).
 * Responses keep the existing `{ data: [...] }` envelope and add a `page`
 * block — backward compatible for existing clients.
 *
 * Usage in a route:
 *   const pg = listParams(request);
 *   const rows = await tx.foo.findMany({ ...args, skip: pg.skip, take: pg.limit + 1 });
 *   return reply.send(listPage(rows, pg));
 */

export const LIST_DEFAULT_LIMIT = 50;
export const LIST_MAX_LIMIT = 200;

export interface ListParams {
  page: number;
  limit: number;
  skip: number;
}

export function listParams(request: FastifyRequest): ListParams {
  const q = (request.query ?? {}) as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const rawLimit = parseInt(String(q.limit ?? ''), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, LIST_MAX_LIMIT)
    : LIST_DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export interface ListPageMeta {
  page: number;
  limit: number;
  hasMore: boolean;
  nextPage: number | null;
}

/**
 * rows must be fetched with `take: limit + 1`. Returns the trimmed data
 * array plus pagination metadata.
 */
export function listPage<T>(rows: T[], pg: ListParams): { data: T[]; page: ListPageMeta } {
  const hasMore = rows.length > pg.limit;
  return {
    data: rows.slice(0, pg.limit),
    page: { page: pg.page, limit: pg.limit, hasMore, nextPage: hasMore ? pg.page + 1 : null },
  };
}

/**
 * For legacy endpoints that return a bare JSON array (no envelope), expose
 * the same pagination metadata as response headers instead of changing the
 * body shape.
 */
export function setPageHeaders(
  reply: { header: (k: string, v: string) => any },
  paged: { page: ListPageMeta },
): void {
  const meta = paged.page;
  reply
    .header('X-Page', String(meta.page))
    .header('X-Limit', String(meta.limit))
    .header('X-Has-More', String(meta.hasMore))
    .header('X-Next-Page', meta.nextPage === null ? '' : String(meta.nextPage));
}
