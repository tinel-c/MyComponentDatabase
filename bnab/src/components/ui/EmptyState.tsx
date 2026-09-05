import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-rim-subtle"
        style={{
          background: "color-mix(in oklch, var(--accent-muted) 80%, transparent)",
          color: "var(--accent)",
        }}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description ? (
          <p className="mx-auto max-w-xs text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
