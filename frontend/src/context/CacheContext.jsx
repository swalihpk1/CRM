import React, { createContext, useCallback, useContext, useRef } from 'react';

/**
 * A tiny invalidation pub/sub bus — deliberately NOT a cache. Replaces the
 * 6 `window.*` globals the old app used for cross-component refresh
 * signaling (window.refreshFollowups, window.refreshActivityLogs,
 * window.refreshMeetings, plus the meeting-scheduler handoff globals
 * handled separately by MeetingSchedulerContext).
 *
 * The key behavior this enables: a view that isn't mounted has no
 * subscriber for its resource key, so invalidating it is a no-op — no
 * network request happens. Previously, e.g., logging a call unconditionally
 * called window.refreshActivityLogs() even when the user wasn't on the
 * Activity Log page, causing a wasted fetch. Now invalidate('activityLogs')
 * only triggers a refetch if a subscriber (the mounted ActivityLogPage) is
 * listening.
 *
 * Known resource keys (informal, not enforced): 'contacts',
 * 'contacts.count', 'followups.upcoming', 'followups.list', 'meetings',
 * 'activityLogs', 'demos.contact:<id>', 'users', 'productivity'.
 */
const CacheContext = createContext(null);

export function CacheProvider({ children }) {
  // Map<key, Set<callback>>
  const subscribersRef = useRef(new Map());

  const subscribe = useCallback((key, callback) => {
    const subs = subscribersRef.current;
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(callback);
    return () => {
      subs.get(key)?.delete(callback);
    };
  }, []);

  const invalidate = useCallback((...keys) => {
    keys.flat().forEach((key) => {
      subscribersRef.current.get(key)?.forEach((callback) => {
        try {
          callback();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`CacheContext: subscriber for "${key}" threw`, e);
        }
      });
    });
  }, []);

  return (
    <CacheContext.Provider value={{ subscribe, invalidate }}>{children}</CacheContext.Provider>
  );
}

export function useCache() {
  const ctx = useContext(CacheContext);
  if (!ctx) throw new Error('useCache must be used within a CacheProvider');
  return ctx;
}

export function useInvalidate() {
  return useCache().invalidate;
}

/**
 * Subscribes `callback` to invalidations of `key` (or an array of keys)
 * while the calling component is mounted. Intended to be called from
 * useQuery/useInfiniteList consumers with their own refetch as the
 * callback, e.g.:
 *   useInvalidationSubscription('activityLogs', refetch)
 */
export function useInvalidationSubscription(keys, callback) {
  const { subscribe } = useCache();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const keyList = Array.isArray(keys) ? keys : [keys];
  const keyString = keyList.join(',');

  React.useEffect(() => {
    const unsubscribers = keyList.map((key) => subscribe(key, () => callbackRef.current()));
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [keyString, subscribe]);
}
