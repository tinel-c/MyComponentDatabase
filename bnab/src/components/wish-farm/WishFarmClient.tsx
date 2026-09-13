"use client";

import { useState, useTransition } from "react";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  moneyClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";
import {
  createWishItemAction,
  deleteWishItemAction,
  harvestWishItemAction,
  type WishFarmResult,
} from "@/app/(app)/more/wish-farm/actions";

export type WishItemRow = {
  id: string;
  name: string;
  amountCents: number;
  fundedCents: number;
  notes: string | null;
};

function ResultBanner({ result }: { result: WishFarmResult | null }) {
  if (!result) return null;
  if (result.ok) return <p className="text-sm text-ok">{result.message}</p>;
  return <p className="text-sm text-danger-fg">{result.error}</p>;
}

export function WishFarmClient({
  items,
  currency,
}: {
  items: WishItemRow[];
  currency: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<WishFarmResult | null>(null);
  const [harvestId, setHarvestId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className={`${cardCompactClass} space-y-2 p-3`}>
        <h2 className="text-sm font-semibold text-fg">New wish</h2>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              setResult(await createWishItemAction(fd));
              e.currentTarget.reset();
            });
          }}
        >
          <label className={labelClass}>
            Name
            <input name="name" required className={inputClass} disabled={pending} />
          </label>
          <label className={labelClass}>
            Goal amount
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder="500.00"
              className={inputClass}
              disabled={pending}
            />
          </label>
          <label className={labelClass}>
            Notes (optional)
            <input name="notes" className={inputClass} disabled={pending} />
          </label>
          <button type="submit" className={buttonPrimaryClass} disabled={pending}>
            {pending ? "Saving…" : "Add wish"}
          </button>
        </form>
      </section>

      <ResultBanner result={result} />

      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className={`${cardCompactClass} p-3 text-sm text-fg-muted`}>
            No wishes yet. Add a goal above — Harvest tracks funded progress
            conceptually from Ready to Assign (plan assign stays optional).
          </li>
        ) : (
          items.map((item) => {
            const pct =
              item.amountCents > 0
                ? Math.min(100, Math.round((item.fundedCents / item.amountCents) * 100))
                : 0;
            return (
              <li key={item.id} className={`${cardCompactClass} space-y-2 p-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{item.name}</p>
                    {item.notes ? (
                      <p className="text-xs text-fg-muted">{item.notes}</p>
                    ) : null}
                    <p className={`mt-1 text-sm text-fg-muted ${moneyClass}`}>
                      {formatMoney(item.fundedCents, currency)} /{" "}
                      {formatMoney(item.amountCents, currency)} ({pct}%)
                    </p>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      start(async () => {
                        setResult(await deleteWishItemAction(fd));
                      });
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className={buttonCompactDangerClass}
                      disabled={pending}
                    >
                      Remove
                    </button>
                  </form>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-overlay"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {harvestId === item.id ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      start(async () => {
                        setResult(await harvestWishItemAction(fd));
                        setHarvestId(null);
                      });
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <label className={`${labelClass} min-w-[8rem] flex-1`}>
                      Harvest amount
                      <input
                        name="amount"
                        required
                        inputMode="decimal"
                        className={inputClass}
                        placeholder="50.00"
                        disabled={pending}
                      />
                    </label>
                    <button
                      type="submit"
                      className={buttonCompactClass}
                      disabled={pending}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className={buttonCompactClass}
                      onClick={() => setHarvestId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className={buttonCompactClass}
                    onClick={() => setHarvestId(item.id)}
                    disabled={pending}
                  >
                    Harvest
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
