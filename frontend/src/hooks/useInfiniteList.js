import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Infinite-scroll pagination hook, replacing the 3 copy-pasted
 * window.scroll-listener implementations from the old App.js (ContactsView,
 * and — via a genuine bug — ActivityLogView twice, which double-fired
 * onLoadMore() per scroll event since it registered the identical effect
 * in two places).
 *
 * Uses an IntersectionObserver on a sentinel element rather than a
 * throttled `window.scroll` listener. This is a deliberate fix, not just a
 * rewrite: the old listener read `document.documentElement.scrollTop`, but
 * the actual scroll container in the app's layout is a nested
 * `overflow-auto` div, so the old implementation only worked incidentally
 * (e.g. when the whole document happened to scroll). An IntersectionObserver
 * on a sentinel is container-agnostic.
 *
 * `fetchPage` is `({skip, limit, ...params}, signal) => Promise<item[]>`.
 * `hasMore` is derived from `page.length === pageSize`, matching the
 * existing backend pagination convention (no total-count in the response).
 *
 * `enabled` (default true) gates fetching entirely — while false, no
 * request is made (e.g. a tab that isn't the active one). Flipping it to
 * true fetches page 0 as if params had just changed; flipping to false
 * does not clear already-loaded items, so switching back doesn't cause a
 * flash of the loading state if nothing else changed.
 *
 * @param {(args: {skip:number, limit:number, params:any}, signal:AbortSignal) => Promise<any[]>} fetchPage
 * @param {{pageSize?: number, params?: any, enabled?: boolean}} [options]
 */
export function useInfiniteList(fetchPage, options = {}) {
  const { pageSize = 20, params, enabled = true } = options;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const pageRef = useRef(0);
  const loadingRef = useRef(false); // ref, not state — avoids the stale-closure
  // bug the old `if (loadingContacts) return` guard had (state read inside a
  // closure created before the state update landed).
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const sentinelRef = useRef(null);
  const paramsKey = JSON.stringify(params ?? {});

  const loadPage = useCallback(
    async (page, { isInitial } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      isInitial ? setIsLoading(true) : setIsLoadingMore(true);
      setError(null);

      const controller = new AbortController();
      try {
        const result = await fetchPageRef.current(
          { skip: page * pageSize, limit: pageSize, params },
          controller.signal
        );
        setItems((prev) => (page === 0 ? result : [...prev, ...result]));
        setHasMore(result.length === pageSize);
        pageRef.current = page;
      } catch (err) {
        if (!err?.isCanceled && err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
          setError(err);
        }
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
      return () => controller.abort();
    },
    [pageSize, paramsKey]
  );

  const reset = useCallback(() => {
    pageRef.current = 0;
    setItems([]);
    setHasMore(true);
    loadPage(0, { isInitial: true });
  }, [loadPage]);

  // Patch a single already-loaded item in place (e.g. after a status change),
  // so the list reflects the change immediately without waiting on a full
  // refetch — matters for fast, frequent edits like table status dropdowns.
  const updateItem = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item))
    );
  }, []);

  // Re-fetch from page 0 whenever params change or this list becomes
  // enabled (subsumes the old `useEffect(() => resetContacts(), [searchQuery,
  // statusFilter])`). Disabled lists never fetch, including on mount.
  useEffect(() => {
    if (enabled) reset();
  }, [paramsKey, enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || loadingRef.current) return;
    loadPage(pageRef.current + 1);
  }, [enabled, hasMore, loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return;

    // IntersectionObserver's default `root: null` means "the browser
    // viewport" — but this app's actual scrollable area is a nested
    // `overflow-auto`/`overflow-y-auto` div (see layouts/AppLayout.jsx),
    // not the window. With no `root` set, the observer only re-evaluates
    // intersection when the SENTINEL'S POSITION RELATIVE TO THE VIEWPORT
    // changes — which barely happens when the user scrolls the inner div
    // (the window itself never moves), so it fires once for the first
    // page (whatever happened to already be in the viewport on mount) and
    // then never again. This was the root cause of "only shows the
    // initial page, doesn't paginate further" on any list whose scroll
    // container isn't the window — walk up to the nearest scrollable
    // ancestor and use that as `root` instead.
    let root = node.parentElement;
    while (root && root !== document.body) {
      const style = window.getComputedStyle(root);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      root = root.parentElement;
    }
    if (!root || root === document.body) root = null; // fall back to viewport

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { root, rootMargin: '300px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, enabled]);

  return { items, isLoading, isLoadingMore, hasMore, error, sentinelRef, reset, updateItem };
}
