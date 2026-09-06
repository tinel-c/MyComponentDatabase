"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Equal, Minus, Plus } from "lucide-react";
import { quickAdjustAssigned } from "@/app/(app)/plan/actions";

type Props = {
  categoryId: string;
  month: string;
  available: number;
  rta: number;
};

const btnBase =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-30 active:scale-95";

export function AssignQuickButtons({
  categoryId,
  month,
  available,
  rta,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(mode: "cover" | "release" | "assignRta") {
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("month", month);
    fd.set("mode", mode);
    start(async () => {
      await quickAdjustAssigned(fd);
      router.refresh();
    });
  }

  const canCover = available < 0;
  const canRelease = available > 0;
  const canAssignRta = rta > 0;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label="Quick assign"
    >
      <button
        type="button"
        disabled={pending || !canCover}
        title="Cover overspend"
        aria-label="Cover overspend"
        className={`${btnBase} border-ok/40 bg-ok/15 text-ok hover:bg-ok/25`}
        onClick={() => run("cover")}
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        disabled={pending || !canRelease}
        title="Release available to Ready to Assign"
        aria-label="Release available"
        className={`${btnBase} border-danger/40 bg-danger-muted text-danger-fg hover:bg-danger/20`}
        onClick={() => run("release")}
      >
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        disabled={pending || !canAssignRta}
        title="Assign all Ready to Assign here"
        aria-label="Assign Ready to Assign"
        className={`${btnBase} border-accent/45 bg-accent-muted text-accent hover:bg-accent/25`}
        onClick={() => run("assignRta")}
      >
        <Equal className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
