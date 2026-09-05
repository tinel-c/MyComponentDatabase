# Envelope math

All money amounts in BNAB are **integer minor units** (bani for RON). Display divides by 100.

Sign convention for transactions:

- **Outflow** (spend): negative amount
- **Inflow** (income / refund): positive amount
- **Transfer**: paired twins; from-account negative, to-account positive; no category on either side (except credit-card payment effects — see below)

---

## Per-category month columns

For category `c` in month `M` (`YYYY-MM`):

```
Assigned(c, M)  = MonthlyCategoryBudget.assigned   // user-set
Activity(c, M)  = sum(transaction.amount for tx in M
                      where categoryId = c
                      and not parent split header
                      and account.onBudget)
```

Available carries forward unless the category is configured otherwise:

```
carryIn = previousMonth.available > 0 ? previousMonth.available : 0
available = carryIn + assigned + activity + ccFundingIn
```

For a normal spending category, Activity is usually ≤ 0.  
**Overspent** when `Available(c, M) < 0`.

---

## Ready to Assign (RTA)

For month `M`:

```
IncomeToRta(M) = sum of inflows on on-budget accounts in M
                 categorized to an Income category (or Ready to Assign)

TotalAssigned(M) = sum of Assigned(c, M) for all non-income categories

CashOverspendDebt(M-1) = sum of abs(min(0, Available(c, M-1)))
                         for categories overspent on cash (not credit)

RTA(M) = IncomeToRta(M)
       + leftover RTA held from M-1 (if "hold for next month")
       - TotalAssigned(M)
       - CashOverspendDebt(M-1)
```

UI states:

| RTA | Meaning | Color |
|-----|---------|-------|
| `> 0` | Money left to give a job | accent / amber |
| `= 0` | Fully assigned | ok / green |
| `< 0` | Over-assigned | danger / red |

Zero-based goal: drive RTA to **0**.

---

## Example (RON)

1. Paycheck inflow +8.000,00 → RTA = 8.000,00  
2. Assign Rent 2.500, Groceries 1.500, Fuel 400, Fun 300, Buffer 3.300 → RTA = 0  
3. Spend 180 on groceries → Groceries Activity = −180, Available = 1.500 − 180 = 1.320  

---

## Credit cards (YNAB-style)

1. Creating an on-budget **creditCard** account creates a system category **Credit Card Payment: {name}** in group *Credit Card Payments*.
2. When you spend 100 from Groceries on the card:
   - Groceries Activity −100 → Available decreases by 100  
   - Engine **moves** 100 into the CC Payment category’s Available (`ccFundingIn += 100`)
3. Paying the card is a **transfer** checking → credit (not a category expense).  
   CC Payment Available decreases by the payment amount.

Credit overspend: spending without Available in the category still increases the card balance but **does not** fully fund CC Payment.

---

## Move money & cover overspending

**Move money** from A → B in month M: adjust Assigned so RTA is unchanged while Available shifts.

**Cover overspending**: move enough from another category (or from RTA) so `Available(overspent) ≥ 0`.

---

## Targets (informational + underfunded hint)

| Type | Meaning |
|------|---------|
| `MONTHLY_SPENDING` | Refill Assigned toward amount each month |
| `NEEDED_BY_DATE` | Save `amount` by `dueDate`; suggested = remaining / months left |
| `WEEKLY` | `amount` × weeks in month |
| `SAVINGS_BALANCE` | Available should reach `amount` |

Underfunded = `Assigned < suggested` for the month (UI hint only).
