"use client";

import { useMemo, useState } from "react";
import {
  cardCompactClass,
  inputClass,
  labelClass,
  moneyClass,
} from "@/components/forms/field-classes";
import { estimatePayoffMonths } from "@/lib/loan-payoff";
import { formatMoney } from "@/lib/money";

type AccountOption = { id: string; name: string };

export function LoanPayoffClient({
  accounts,
  currency,
}: {
  accounts: AccountOption[];
  currency: string;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [payment, setPayment] = useState("");

  const estimate = useMemo(() => {
    const b = Number(balance.replace(",", "."));
    const a = Number(apr.replace(",", "."));
    const p = Number(payment.replace(",", "."));
    if (![b, a, p].every((n) => Number.isFinite(n))) return null;
    return estimatePayoffMonths({ balance: b, aprPercent: a, payment: p });
  }, [balance, apr, payment]);

  const accountName =
    accounts.find((a) => a.id === accountId)?.name ?? "loan";

  return (
    <div className="space-y-4">
      <section className={`${cardCompactClass} space-y-3 p-3`}>
        <h2 className="text-sm font-semibold text-fg">Loan inputs</h2>
        <p className="text-xs text-fg-muted">
          Pick a tracking liability for context. Math is local — no bank sync.
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No tracking liability accounts yet. Add one under Accounts (type:
            tracking liability), then return here.
          </p>
        ) : (
          <label className={labelClass}>
            Tracking liability
            <select
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={labelClass}>
          Current balance
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="12500.00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          APR %
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="7.5"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Monthly payment
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="450.00"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          />
        </label>
      </section>

      <section className={`${cardCompactClass} space-y-2 p-3`}>
        <h2 className="text-sm font-semibold text-fg">Payoff estimate</h2>
        {!estimate ? (
          <p className="text-sm text-fg-muted">Enter balance, APR, and payment.</p>
        ) : estimate.never ? (
          <p className="text-sm text-danger-fg">
            Payment never covers interest on {accountName}. Raise the payment or
            lower the balance.
          </p>
        ) : estimate.months == null ? (
          <p className="text-sm text-fg-muted">Need positive balance and payment.</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-fg-muted">Months to payoff</dt>
              <dd className={`text-lg font-semibold text-fg ${moneyClass}`}>
                {estimate.months}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Approx. years</dt>
              <dd className={`text-lg font-semibold text-fg ${moneyClass}`}>
                {(estimate.months / 12).toFixed(1)}
              </dd>
            </div>
            {estimate.totalInterest != null ? (
              <div className="sm:col-span-2">
                <dt className="text-fg-muted">Est. total interest</dt>
                <dd className={`font-medium text-fg ${moneyClass}`}>
                  {formatMoney(Math.round(estimate.totalInterest * 100), currency)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </section>
    </div>
  );
}
