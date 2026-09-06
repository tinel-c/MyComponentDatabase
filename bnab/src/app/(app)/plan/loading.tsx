import { cardClass } from "@/components/forms/field-classes";

export default function PlanLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-8 w-40 rounded-lg bg-overlay" />
      <div className={`${cardClass} h-14 bg-overlay/60`} />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${cardClass} space-y-2 p-4`}>
            <div className="h-4 w-28 rounded bg-overlay" />
            <div className="h-9 rounded bg-overlay/70" />
            <div className="h-9 rounded bg-overlay/70" />
            <div className="h-9 rounded bg-overlay/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
