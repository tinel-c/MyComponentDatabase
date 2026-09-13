"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PendingAction = {
  id: string;
  label: string;
  startedAt: number;
};

type PendingActionsContextValue = {
  pending: PendingAction[];
  count: number;
  trackPending: (label: string) => string;
  clearPending: (id: string) => void;
  runPending: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

const PendingActionsContext = createContext<PendingActionsContextValue | null>(
  null,
);

let seq = 0;

export function PendingActionsProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingAction[]>([]);

  const trackPending = useCallback((label: string) => {
    const id = `p-${Date.now()}-${++seq}`;
    setPending((prev) => [...prev, { id, label, startedAt: Date.now() }]);
    return id;
  }, []);

  const clearPending = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const runPending = useCallback(
    async <T,>(label: string, fn: () => Promise<T>) => {
      const id = trackPending(label);
      try {
        return await fn();
      } finally {
        clearPending(id);
      }
    },
    [trackPending, clearPending],
  );

  const value = useMemo(
    () => ({
      pending,
      count: pending.length,
      trackPending,
      clearPending,
      runPending,
    }),
    [pending, trackPending, clearPending, runPending],
  );

  return (
    <PendingActionsContext.Provider value={value}>
      {children}
    </PendingActionsContext.Provider>
  );
}

export function usePendingActions() {
  const ctx = useContext(PendingActionsContext);
  if (!ctx) {
    throw new Error("usePendingActions must be used within PendingActionsProvider");
  }
  return ctx;
}

/** Safe when provider might be absent (tests / partial trees). */
export function usePendingActionsOptional() {
  return useContext(PendingActionsContext);
}
