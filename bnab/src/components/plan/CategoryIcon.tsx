import { categoryIcon } from "@/lib/category-icons";

type Props = {
  name: string;
  groupName?: string;
  className?: string;
  /** Icon size in rem units via Tailwind size-* */
  size?: "xs" | "sm" | "md";
};

export function CategoryIcon({
  name,
  groupName,
  className = "",
  size = "sm",
}: Props) {
  const Icon = categoryIcon(name, groupName);
  const box =
    size === "xs" ? "size-6" : size === "sm" ? "size-7" : "size-8";
  const glyph =
    size === "xs" ? "size-3" : size === "sm" ? "size-3.5" : "size-4";
  const radius = size === "xs" ? "rounded-md" : "rounded-lg";

  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center ${radius} bg-accent-muted/70 ${className}`}
      aria-hidden
    >
      <Icon className={glyph} style={{ color: "var(--accent)" }} strokeWidth={2} />
    </span>
  );
}
