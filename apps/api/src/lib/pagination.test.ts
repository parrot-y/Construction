import { describe, expect, it } from 'vitest';
import { listPage, listParams, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from './pagination';

const req = (query: Record<string, unknown>) => ({ query }) as any;

describe('pagination helper', () => {
  it('defaults to limit 50 page 1', () => {
    const pg = listParams(req({}));
    expect(pg.limit).toBe(LIST_DEFAULT_LIMIT);
    expect(pg.page).toBe(1);
    expect(pg.skip).toBe(0);
  });

  it('clamps limit to max 200 and rejects junk', () => {
    expect(listParams(req({ limit: '500' })).limit).toBe(LIST_MAX_LIMIT);
    expect(listParams(req({ limit: 'abc' })).limit).toBe(LIST_DEFAULT_LIMIT);
    expect(listParams(req({ limit: '0' })).limit).toBe(LIST_DEFAULT_LIMIT);
    expect(listParams(req({ limit: '-5' })).limit).toBe(LIST_DEFAULT_LIMIT);
  });

  it('computes skip for page N', () => {
    expect(listParams(req({ page: '3', limit: '10' })).skip).toBe(20);
  });

  it('slices limit+1 rows and reports hasMore/nextPage', () => {
    const rows = Array.from({ length: 51 }, (_, i) => i);
    const pg = listParams(req({ limit: '50' }));
    const out = listPage(rows, pg);
    expect(out.data).toHaveLength(50);
    expect(out.page.hasMore).toBe(true);
    expect(out.page.nextPage).toBe(2);

    const last = listPage(rows.slice(0, 50), pg);
    expect(last.page.hasMore).toBe(false);
    expect(last.page.nextPage).toBeNull();
  });
});
