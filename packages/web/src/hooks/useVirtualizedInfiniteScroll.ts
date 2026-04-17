import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInfiniteScrollOptions<T, A extends unknown[]> {
  fetchPage: (
    page: number,
    limit: number,
    ...args: A
  ) => Promise<{ items: T[]; hasMore: boolean; total?: number }>;
  limit?: number;
  deps?: A;
}

export interface UseInfiniteScrollReturn<T> {
  items: T[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  hasMore: boolean;
  total: number;
  prepend: (item: T) => void;
  updateItem: (item: T) => void;
  removeItem: (id: string) => void;
  reset: () => void;
  retry: () => void;
  sentinelRef: (el: HTMLDivElement | null) => void;
}

export function useVirtualizedInfiniteScroll<T, A extends unknown[]>({
  fetchPage,
  limit = 24,
  deps = [] as unknown as A,
}: UseInfiniteScrollOptions<T, A>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  hasMoreRef.current = hasMore;
  isFetchingRef.current = isFetching;

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const sentinelRefInternal = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Initial value is a no-op; immediately overwritten after render
  // biome-ignore lint/suspicious/noEmptyBlockStatements: initial no-op value is immediately replaced
  const fetchMoreFnRef = useRef<() => void>(() => {});

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally uses deps inside via fetchPageRef; deps changes trigger refetch via useEffect
  const loadPage = useCallback(
    async (page: number, isInitial = false) => {
      if (isFetchingRef.current) return;
      if (!isInitial && !hasMoreRef.current) return;

      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsFetching(true);
      }
      setIsError(false);

      try {
        const result = await fetchPageRef.current(page, limit, ...deps);
        if (!isMountedRef.current) return;

        if (isInitial) {
          setItems(result.items);
          setHasMore(result.hasMore);
          if (result.total !== undefined) setTotal(result.total);
          pageRef.current = 1;
        } else {
          setItems((prev) => [...prev, ...result.items]);
          setHasMore(result.hasMore);
          pageRef.current = page;
        }
      } catch {
        if (!isMountedRef.current) return;
        setIsError(true);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    },
    [limit]
  );

  const fetchMore = useCallback(() => {
    if (!hasMoreRef.current || isFetchingRef.current) return;
    const nextPage = pageRef.current + 1;
    void loadPage(nextPage);
  }, [loadPage]);

  fetchMoreFnRef.current = fetchMore;

  const retry = useCallback(() => {
    setIsError(false);
    const nextPage = pageRef.current + 1;
    void loadPage(nextPage);
  }, [loadPage]);

  const prepend = useCallback((item: T) => {
    setItems((prev) => {
      if (prev.some((i) => (i as { id: string }).id === (item as { id: string }).id)) return prev;
      return [item, ...prev];
    });
  }, []);

  const updateItem = useCallback((item: T) => {
    setItems((prev) =>
      prev.map((i) => ((i as { id: string }).id === (item as { id: string }).id ? item : i))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => (i as { id: string }).id !== id));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    pageRef.current = 1;
    setHasMore(true);
    setIsError(false);
    void loadPage(1, true);
  }, [loadPage]);

  // Initial load
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on deps to refetch on search change; loadPage is stable via ref
  useEffect(() => {
    isMountedRef.current = true;
    void loadPage(1, true);

    return () => {
      isMountedRef.current = false;
    };
  }, [...deps]);

  // IntersectionObserver — created once, reads fetchMore via ref so it never goes stale
  const setSentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (sentinelRefInternal.current === el) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    sentinelRefInternal.current = el;

    if (!el) return;

    observerRef.current = new IntersectionObserver(
      () => {
        fetchMoreFnRef.current();
      },
      { rootMargin: '300px' }
    );

    observerRef.current.observe(el);
  }, []); // intentionally empty — reads fetchMore via ref

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return {
    items,
    isLoading,
    isFetching,
    isError,
    hasMore,
    total,
    prepend,
    updateItem,
    removeItem,
    reset,
    retry,
    sentinelRef: setSentinelRef,
  };
}
