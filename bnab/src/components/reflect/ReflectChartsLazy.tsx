"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { cardClass } from "@/components/forms/field-classes";

const Charts = dynamic(
  () =>
    import("@/components/reflect/ReflectCharts").then((m) => m.ReflectCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`${cardClass} h-72 animate-pulse bg-overlay/70`}
          />
        ))}
      </div>
    ),
  },
);

export function ReflectChartsLazy(props: ComponentProps<typeof Charts>) {
  return <Charts {...props} />;
}
