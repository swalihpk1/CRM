import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * Mounts a single ConfirmDialog instance app-wide and exposes
 * `confirm(options) => Promise<boolean>`, replacing every
 * `window.confirm(...)` call site.
 *
 * A promise-based API (rather than a per-call-site controlled
 * <ConfirmDialog open={}>) was chosen specifically because every existing
 * call site is `if (!window.confirm(...)) return;` inside an async
 * handler — this preserves that exact one-line-change shape:
 *   if (!(await confirm({ title, description, destructive }))) return;
 *
 * Resolves `false` on outside-click/Escape (Radix's onOpenChange(false))
 * so a dismissed dialog never leaves a forever-pending promise.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const settle = useCallback((result) => {
    setState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        destructive={state.options.destructive}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirmContext() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
