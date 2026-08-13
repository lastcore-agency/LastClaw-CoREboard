/* ────────────────────────────────────────────────────────────
   RuntimeContext — single shared runtime snapshot
   All pages (Center, Inspector, Studio, Board, Chat) read from here.
   Never create a second fetch loop.
   ──────────────────────────────────────────────────────────── */

import { createContext, useContext, type ReactNode } from 'react';
import { useRuntimeSnapshot, type RuntimeSnapshot } from '../lib/useRuntimeSnapshot';

const RuntimeContext = createContext<RuntimeSnapshot | null>(null);

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const snapshot = useRuntimeSnapshot();
  return (
    <RuntimeContext.Provider value={snapshot}>
      {children}
    </RuntimeContext.Provider>
  );
}

/** Hook to access the shared runtime snapshot. Must be used inside RuntimeProvider. */
export function useRuntime(): RuntimeSnapshot {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error('useRuntime must be used within RuntimeProvider');
  }
  return ctx;
}
