"use client";

import { useState, useTransition } from "react";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { DEFAULT_ERASE_FLAGS } from "@/lib/data-tools/selective-erase";
import {
  freshStartEraseAction,
} from "@/app/(app)/more/fresh-start/actions";
import type { DataToolsResult } from "@/app/(app)/more/data/actions";

const ERASE_OPTIONS: {
  key: keyof typeof DEFAULT_ERASE_FLAGS;
  label: string;
  hint: string;
}[] = [
  {
    key: "transactions",
    label: "Transactions",
    hint: "All ledger rows on this budget’s accounts",
  },
  {
    key: "importBatches",
    label: "Import batches",
    hint: "ING batch history and fingerprints",
  },
  {
    key: "receiptScans",
    label: "Receipt scans",
    hint: "Bill photos and scan lines",
  },
  {
    key: "monthlyBudgets",
    label: "Monthly plan data",
    hint: "Assignments, targets, and month notes",
  },
  {
    key: "payees",
    label: "Payees",
    hint: "Merchant / payee list",
  },
  {
    key: "schedules",
    label: "Scheduled / planned",
    hint: "Recurring templates and planned payments",
  },
  {
    key: "importRules",
    label: "Import category rules",
    hint: "Usually keep — remaps bank memos",
  },
  {
    key: "receiptRules",
    label: "Receipt category rules",
    hint: "Usually keep — bill line mappings",
  },
  {
    key: "categories",
    label: "Categories & groups",
    hint: "Envelope structure (default: keep)",
  },
  {
    key: "accounts",
    label: "Finance accounts",
    hint: "Bank / cash accounts (default: keep)",
  },
];

type Step = 1 | 2 | 3;

export function FreshStartWizard() {
  const [step, setStep] = useState<Step>(1);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DataToolsResult | null>(null);
  const [flags, setFlags] = useState({ ...DEFAULT_ERASE_FLAGS });

  function applyPreset(kind: "ledger" | "nuclear" | "keepStructure") {
    if (kind === "ledger") {
      setFlags({ ...DEFAULT_ERASE_FLAGS });
    } else if (kind === "keepStructure") {
      setFlags({
        ...DEFAULT_ERASE_FLAGS,
        payees: false,
        schedules: false,
      });
    } else {
      setFlags({
        transactions: true,
        importBatches: true,
        receiptScans: true,
        monthlyBudgets: true,
        payees: true,
        schedules: true,
        importRules: true,
        receiptRules: true,
        categories: true,
        accounts: true,
      });
    }
  }

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-xs font-medium">
        {([1, 2, 3] as const).map((n) => (
          <li
            key={n}
            className={`rounded-full px-2.5 py-1 ${
              step === n
                ? "bg-accent-muted text-accent"
                : step > n
                  ? "bg-ok/20 text-ok"
                  : "bg-overlay text-fg-muted"
            }`}
          >
            {n === 1 ? "Choose" : n === 2 ? "Confirm" : "Done"}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className={`${cardCompactClass} space-y-3 p-3`}>
          <h2 className="text-sm font-semibold text-fg">What should go?</h2>
          <p className="text-xs text-fg-muted">
            Defaults wipe ledger and plan data but keep accounts, categories,
            and mapping rules — a typical Fresh Start.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonCompactClass}
              onClick={() => applyPreset("ledger")}
            >
              Fresh ledger
            </button>
            <button
              type="button"
              className={buttonCompactClass}
              onClick={() => applyPreset("keepStructure")}
            >
              Keep payees & schedules
            </button>
            <button
              type="button"
              className={buttonCompactClass}
              onClick={() => applyPreset("nuclear")}
            >
              Wipe structure too
            </button>
          </div>
          <ul className="space-y-1.5">
            {ERASE_OPTIONS.map(({ key, label, hint }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={(e) =>
                      setFlags((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="font-medium text-fg">{label}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={buttonPrimaryClass}
            disabled={!Object.values(flags).some(Boolean)}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={`${cardCompactClass} space-y-3 p-3`}>
          <h2 className="text-sm font-semibold text-fg">Confirm erase</h2>
          <p className="text-xs text-fg-muted">
            This cannot be undone (export a backup from More → Data first if
            you need one). Type{" "}
            <span className="font-mono text-fg">DELETE</span> to proceed.
          </p>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              for (const [key, on] of Object.entries(flags)) {
                if (on) fd.set(key, "on");
              }
              start(async () => {
                const res = await freshStartEraseAction(fd);
                setResult(res);
                if (res.ok) setStep(3);
              });
            }}
          >
            <label className={labelClass}>
              Confirm phrase
              <input
                name="confirm"
                className={inputClass}
                placeholder="DELETE"
                autoComplete="off"
                disabled={pending}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonSecondaryClass}
                disabled={pending}
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="submit"
                className={buttonCompactDangerClass}
                disabled={pending}
              >
                {pending ? "Erasing…" : "Run Fresh Start"}
              </button>
            </div>
            {result && !result.ok ? (
              <p className="text-sm text-danger-fg">{result.error}</p>
            ) : null}
          </form>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={`${cardCompactClass} space-y-3 p-3`}>
          <h2 className="text-sm font-semibold text-fg">You’re ready</h2>
          <p className="text-sm text-ok">
            {result && result.ok ? result.message : "Fresh Start completed."}
          </p>
          <p className="text-xs text-fg-muted">
            Next: set account balances (or import ING), then assign Ready to
            Assign on Plan.
          </p>
          <a href="/plan" className={buttonPrimaryClass}>
            Go to Plan
          </a>
        </section>
      ) : null}
    </div>
  );
}
