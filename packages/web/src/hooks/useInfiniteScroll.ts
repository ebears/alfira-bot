import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  enabled?: boolean;
  threshold?: number;
}

interface Return<T> {
  items: T[];
  total: number;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  setTotal: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  reset: () => void;
}

export function useInfiniteScroll<T>(
  fetchFn: (page: number) => Promise<{ items: T[]; total: number }>,
  options: Options = {}
): Return<T> {
  const { enabled = true, threshold = 200 } = options;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [_page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);

  const hasMore = items.length < total;

  const loadPage = useCallback(
    async (pageNum: number, isFirstPage: boolean) => {
      loadingRef.current = true;
      if (isFirstPage) {
        setLoading(true);
        setLoadingMore(false);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await fetchFn(pageNum);
        setItems((prev) => (isFirstPage ? result.items : [...prev, ...result.items]));
        setTotal(result.total);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [fetchFn]
  );

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setTotal(0);
    setLoading(true);
    setLoadingMore(false);
    void loadPage(1, true);
  }, [loadPage]);

  useEffect(() => {
    if (enabled) {
      void loadPage(1, true);
    }
  }, [enabled, loadPage]);

  useEffect(() => {
    if (!enabled) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingRef.current && enabled) {
          setPage((prev) => {
            const next = prev + 1;
            void loadPage(next, false);
            return next;
          });
        }
      },
      { rootMargin: `${threshold}px` }
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [enabled, threshold, hasMore, loadPage]);

  return { items, total, setItems, setTotal, loading, loadingMore, hasMore, sentinelRef, reset };
}
