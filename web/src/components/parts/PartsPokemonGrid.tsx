/**
 * Grid for part cards — equal-height rows (PART_CARD_RULES.md §1).
 */
import type { PartCardModel } from "@/components/parts/PartPokemonCard";
import { PartPokemonCard } from "@/components/parts/PartPokemonCard";

type Props = {
  parts: PartCardModel[];
  baseUrl: string;
  emptyMessage: string;
};

export function PartsPokemonGrid({ parts, baseUrl, emptyMessage }: Props) {
  if (parts.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-rim/40 bg-surface/30 py-16 text-center text-fg-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {parts.map((p) => (
        <div key={p.id} className="flex h-full min-h-0 w-full min-w-0">
          <PartPokemonCard
            part={p}
            absolutePartUrl={`${baseUrl}/parts/${p.id}`}
          />
        </div>
      ))}
    </div>
  );
}
