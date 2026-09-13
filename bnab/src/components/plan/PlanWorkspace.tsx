"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePendingActionsOptional } from "@/components/providers/PendingActionsProvider";
import type { PlanCellPatch } from "@/app/(app)/plan/actions";

export type PlanRowState = {
  available: number;
  activity: number;
  assigned: number;
};

type PlanWorkspaceValue = {
  month: string;
  currency: string;
  rows: Record<string, PlanRowState>;
  rta: number;
  totalAssigned: number;
  applyPatch: (patch: PlanCellPatch) => void;
  setCategoryAssignedLocal: (
    categoryId: string,
    assigned: number,
  ) => void;
};

const PlanWorkspaceContext = createContext<PlanWorkspaceValue | null>(null);

export function PlanWorkspace({
  month,
  currency,
  initialRows,
  initialRta,
  initialTotalAssigned,
  children,
}: {
  month: string;
  currency: string;
  initialRows: Record<string, PlanRowState>;
  initialRta: number;
  initialTotalAssigned: number;
  children: ReactNode;
}) {
  const [rows, setRows] = useState(initialRows);
  const [rta, setRta] = useState(initialRta);
  const [totalAssigned, setTotalAssigned] = useState(initialTotalAssigned);
  const pending = usePendingActionsOptional();
  const localDirty = useRef(false);

  // Remount-equivalent when the month changes.
  useEffect(() => {
    localDirty.current = false;
    setRows(initialRows);
    setRta(initialRta);
    setTotalAssigned(initialTotalAssigned);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- month navigation only
  }, [month]);

  // Accept fresh RSC props only when we have not applied a local optimistic patch.
  // Otherwise a soft refresh fed by a still-warm tagged cache can wipe the first click.
  useEffect(() => {
    if (localDirty.current) return;
    setRows(initialRows);
    setRta(initialRta);
    setTotalAssigned(initialTotalAssigned);
  }, [initialRows, initialRta, initialTotalAssigned]);

  const applyPatch = useCallback((patch: PlanCellPatch) => {
    if (!patch?.ok) return;
    localDirty.current = true;
    setRows((prev) => {
      const cur = prev[patch.categoryId] ?? {
        available: 0,
        activity: 0,
        assigned: 0,
      };
      return {
        ...prev,
        [patch.categoryId]: {
          ...cur,
          assigned: patch.assigned,
          available: patch.available,
        },
      };
    });
    setRta(patch.rta);
    setTotalAssigned(patch.totalAssigned);
  }, []);

  const setCategoryAssignedLocal = useCallback(
    (categoryId: string, assigned: number) => {
      localDirty.current = true;
      setRows((prev) => {
        const cur = prev[categoryId] ?? {
          available: 0,
          activity: 0,
          assigned: 0,
        };
        const delta = assigned - cur.assigned;
        setRta((r) => r - delta);
        setTotalAssigned((t) => t + delta);
        return {
          ...prev,
          [categoryId]: {
            ...cur,
            assigned,
            available: cur.available + delta,
          },
        };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      month,
      currency,
      rows,
      rta,
      totalAssigned,
      applyPatch,
      setCategoryAssignedLocal,
    }),
    [
      month,
      currency,
      rows,
      rta,
      totalAssigned,
      applyPatch,
      setCategoryAssignedLocal,
    ],
  );

  // Expose pending helper for children without forcing provider
  void pending;

  return (
    <PlanWorkspaceContext.Provider value={value}>
      {children}
    </PlanWorkspaceContext.Provider>
  );
}

export function usePlanWorkspace() {
  const ctx = useContext(PlanWorkspaceContext);
  if (!ctx) {
    throw new Error("usePlanWorkspace must be used within PlanWorkspace");
  }
  return ctx;
}

export function usePlanWorkspaceOptional() {
  return useContext(PlanWorkspaceContext);
}
