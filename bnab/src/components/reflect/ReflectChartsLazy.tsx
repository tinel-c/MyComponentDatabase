"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const Charts = dynamic(
  () =>
    import("@/components/reflect/ReflectCharts").then((m) => m.ReflectCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-2xl bg-overlay/70" aria-hidden />
    ),
  },
);

export function ReflectChartsLazy(
  props: ComponentProps<typeof Charts>,
) {
  return <Charts {...props} />;
}
