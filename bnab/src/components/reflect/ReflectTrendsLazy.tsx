"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { cardCompactClass } from "@/components/forms/field-classes";

const Trends = dynamic(
  () =>
    import("@/components/reflect/ReflectTrends").then((m) => m.ReflectTrends),
  {
    ssr: false,
    loading: () => (
      <div className={`${cardCompactClass} h-80 animate-pulse bg-overlay/70`} />
    ),
  },
);

export function ReflectTrendsLazy(props: ComponentProps<typeof Trends>) {
  return <Trends {...props} />;
}
