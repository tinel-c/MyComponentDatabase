import { cardClass } from "@/components/forms/field-classes";

export default function ReflectLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="h-8 w-36 rounded-lg bg-overlay" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${cardClass} h-72 bg-overlay/50`} />
        ))}
      </div>
    </div>
  );
}
