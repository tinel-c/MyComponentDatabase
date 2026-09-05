import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CreditCard,
  Landmark,
  PiggyBank,
  Scale,
  Wallet,
} from "lucide-react";

const TYPE_META: Record<
  string,
  { icon: LucideIcon; label: string; accent: string }
> = {
  CHECKING: { icon: Landmark, label: "Checking", accent: "var(--accent)" },
  SAVINGS: { icon: PiggyBank, label: "Savings", accent: "var(--ok)" },
  CASH: { icon: Wallet, label: "Cash", accent: "var(--fg-muted)" },
  CREDIT_CARD: { icon: CreditCard, label: "Credit card", accent: "var(--danger)" },
  TRACKING_ASSET: { icon: Building2, label: "Tracking asset", accent: "var(--accent)" },
  TRACKING_LIABILITY: {
    icon: Scale,
    label: "Tracking liability",
    accent: "var(--danger)",
  },
};

export function accountTypeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      icon: Wallet,
      label: type.replaceAll("_", " ").toLowerCase(),
      accent: "var(--accent)",
    }
  );
}

/** Stable accent for category group headers from name. */
export function groupAccent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [160, 200, 280, 30, 340, 120, 50];
  const hue = hues[h % hues.length];
  return `oklch(0.62 0.14 ${hue})`;
}
