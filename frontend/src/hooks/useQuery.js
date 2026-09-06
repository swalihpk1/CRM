import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Fetch-on-mount / fetch-on-deps-change hook with abort-on-supersede.
 *
 * `fetcher` is `(signal) => Promise<data>`. Pass `{ signal }` through to the
 * underlying api/* call (axios supports an AbortController signal) so a
 * superseded request is actually cancelled, not just ignored.
 *
 * Guards against two real races present in the old code:
 *  - rapid param changes (e.g. clicking date-filter buttons quickly) could
 *    let a slower earlier response overwrite a newer one — this hook
 *    aborts the previous request and also ignores any late-arriving
 *    response from a superseded run via a monotonic request id.
 *  - React 18/19 StrictMode's dev double-invoke of effects, which under
 *    the old code fired every mount fetch twice.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {any[]} deps
 * @param {{enabled?: boolean, onSuccess?: (data:any)=>void, onError?: (err:any)=>void}} [options]
 */
export function useQuery(fetcher, deps, options = {}) {
  const { enabled = true, onSuccess, onError } = options;
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const run = useCallback(() => {
    if (!enabled) {
      setIsLoading(false);
      return () => {};
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    Promise.resolve(fetcherRef.current(controller.signal))
      .then((result) => {
        if (requestIdRef.current !== requestId) return; // superseded
        setData(result);
        setIsLoading(false);
        onSuccessRef.current?.(result);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return; // superseded/aborted
        if (err?.isCanceled || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
      });

    return () => controller.abort();
  }, [enabled]);

  useEffect(() => {
    const abort = run();
    return abort;
  }, deps);

  const refetch = useCallback(() => run(), [run]);

  return { data, error, isLoading, refetch };
}
