import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-rim-subtle"
        style={{
          background: "color-mix(in oklch, var(--accent-muted) 80%, transparent)",
          color: "var(--accent)",
        }}
      >
        <Icon className="size-7" />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-fg-muted">{description}</p>
      ) : null}
    </div>
  );
}
