/**
 * Estimate months to pay off a fixed-payment loan (amortization).
 * APR is annual percent (e.g. 7.5). Balance and payment are major currency units
 * or any consistent units — only their ratio matters for month count.
 */
export function estimatePayoffMonths(input: {
  balance: number;
  aprPercent: number;
  payment: number;
}): { months: number | null; never: boolean; totalInterest: number | null } {
  const principal = input.balance;
  const payment = input.payment;
  if (!(principal > 0) || !(payment > 0)) {
    return { months: null, never: false, totalInterest: null };
  }

  const r = input.aprPercent / 100 / 12;
  if (r <= 0) {
    const months = Math.ceil(principal / payment);
    return { months, never: false, totalInterest: 0 };
  }

  // Payment must cover first month's interest.
  if (payment <= principal * r) {
    return { months: null, never: true, totalInterest: null };
  }

  // n = ln(p / (p - B*r)) / ln(1+r)
  const monthsExact =
    Math.log(payment / (payment - principal * r)) / Math.log(1 + r);
  const months = Math.ceil(monthsExact);
  const totalPaid = payment * monthsExact;
  const totalInterest = Math.max(0, totalPaid - principal);
  return { months, never: false, totalInterest };
}
