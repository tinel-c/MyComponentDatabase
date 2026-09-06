import { cardClass } from "@/components/forms/field-classes";

export default function TransactionsLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="flex justify-between gap-3">
        <div className="h-8 w-48 rounded-lg bg-overlay" />
        <div className="h-11 w-24 rounded-full bg-overlay" />
      </div>
      <div className={`${cardClass} h-24 bg-overlay/50`} />
      <div className={`${cardClass} divide-y divide-rim-subtle`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-12 items-center gap-3 px-3">
            <div className="h-4 flex-1 rounded bg-overlay" />
            <div className="h-4 w-20 rounded bg-overlay" />
          </div>
        ))}
      </div>
    </div>
  );
}
