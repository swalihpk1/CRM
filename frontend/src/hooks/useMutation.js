import { useCallback, useState } from 'react';
import { toast } from '../components/ui/sonner';
import { useInvalidate } from '../context/CacheContext';

/**
 * Wraps a write operation (create/update/delete) with pending state, a
 * success/error toast, and scoped cache invalidation — replacing the
 * repeated `try { await axios... } catch { alert(...) } finally {}` block
 * plus manual `fetchX()`/`window.refreshX()` cascades that were copy-pasted
 * after nearly every mutation in the old App.js.
 *
 * `mutationFn` is `(args) => Promise<result>`.
 * `invalidates` is a resource key or array of keys to invalidate (via
 * CacheContext) on success — only views actually mounted and subscribed to
 * those keys will refetch; this is what shrinks a mutation's blast radius
 * from "refresh everything" to "refresh what could have changed, if
 * anyone's looking at it".
 *
 * @param {(args:any) => Promise<any>} mutationFn
 * @param {{
 *   successMessage?: string | ((result:any, args:any) => string),
 *   errorMessage?: string | ((err:any, args:any) => string),
 *   invalidates?: string | string[],
 *   onSuccess?: (result:any, args:any) => void,
 *   onError?: (err:any, args:any) => void,
 *   silent?: boolean, // skip the success toast (still shows errors)
 * }} [options]
 */
export function useMutation(mutationFn, options = {}) {
  const { successMessage, errorMessage, invalidates, onSuccess, onError, silent } = options;
  const invalidate = useInvalidate();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(
    async (args) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await mutationFn(args);

        if (invalidates) {
          const keys = Array.isArray(invalidates) ? invalidates : [invalidates];
          invalidate(...keys);
        }

        if (!silent) {
          const message =
            typeof successMessage === 'function' ? successMessage(result, args) : successMessage;
          if (message) toast.success(message);
        }

        onSuccess?.(result, args);
        return result;
      } catch (err) {
        setError(err);
        const message =
          typeof errorMessage === 'function'
            ? errorMessage(err, args)
            : errorMessage || err?.detail || 'Something went wrong';
        toast.error(message);
        onError?.(err, args);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn, invalidates, invalidate, successMessage, errorMessage, silent, onSuccess, onError]
  );

  return { mutate, isPending, error };
}
