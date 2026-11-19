import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { apiErrorMessage } from '../../lib/api';

/**
 * P4.3 — paged list loader for collection endpoints that return
 * `{ data|invoices|members: [...], page: { hasMore, nextPage } }`.
 * Loads page 1 on mount/url change and appends on `loadMore`, so lists
 * longer than the server page size are never silently truncated.
 */
export function usePagedList<T = any>(baseUrl: string | null, deps: any[] = [], limit = 50) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(!!baseUrl);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const baseRef = useRef(baseUrl);
  baseRef.current = baseUrl;

  const urlFor = useCallback((page: number) => {
    const base = baseRef.current;
    if (!base) return null;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}page=${page}&limit=${limit}`;
  }, [limit]);

  const extract = (j: any): T[] =>
    j?.data ?? j?.invoices ?? j?.members ?? (Array.isArray(j) ? j : []);

  const load = useCallback(async (page: number, append: boolean) => {
    const url = urlFor(page);
    if (!url) { setLoading(false); return; }
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const j: any = await api.get(url);
      const rows = extract(j) as T[];
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(Boolean(j?.page?.hasMore));
      pageRef.current = page;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this list. Try again.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFor, ...deps]);

  // Reset + reload page 1 whenever the base url or deps change.
  useEffect(() => {
    pageRef.current = 1;
    setItems([]);
    void load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, ...deps]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void load(pageRef.current + 1, true);
  }, [load, loadingMore, loading, hasMore]);

  const reload = useCallback(() => {
    pageRef.current = 1;
    void load(1, false);
  }, [load]);

  return { items, setItems, hasMore, loading, loadingMore, error, loadMore, reload };
}
