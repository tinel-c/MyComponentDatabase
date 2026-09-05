"use client";

import { useOptimistic, useTransition } from "react";
import { toggleCleared } from "@/app/(app)/transactions/actions";

export function ClearToggle({
  id,
  cleared,
}: {
  id: string;
  cleared: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(cleared);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={optimistic ? "Uncleared" : "Clear"}
      className={`size-6 shrink-0 rounded-full border transition-colors ${
        optimistic ? "border-ok bg-ok" : "border-rim bg-transparent"
      } ${pending ? "opacity-60" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOptimistic(!optimistic);
          const fd = new FormData();
          fd.set("id", id);
          await toggleCleared(fd);
        });
      }}
    />
  );
}
