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
                      and account.onBudget
                      and not transfer
                      and not excludeFromRta)
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

Computed in `src/lib/budget-engine/index.ts` as:

```
RTA(M) = incomeToRta(M) − totalAssigned(M) − nextHeld(M)
```

where `incomeToRta` is built in order:

```
incomeToRta = heldFromPrev(M−1)
            − CashOverspendDebt(M−1)
            + Σ qualifying on-budget txns in M
```

Qualifying RTA inflows (skip transfers, `excludeFromRta`, off-budget):

- starting balances
- uncategorized amounts (balance adjustments)
- categorized **Income** categories (Paycheck, Other income, …)

```
CashOverspendDebt(M−1) = Σ |Available(c, M−1)|
  for non-income c where Available < 0 and c is not a CC payment category

TotalAssigned(M) = Σ Assigned(c, M) for all non-income categories

nextHeld = (holdForNextMonth && rawRta > 0)
           ? (heldAmount > 0 ? min(heldAmount, rawRta) : rawRta)
           : 0
```

**Banner vs Income section (important):**

| UI label | Source | Includes |
|----------|--------|----------|
| Banner **Income** | `plan.incomeToRta` | Income cats + starting balances + uncategorized ± −cash overspend + held-from-prev |
| Income section **Received** | Σ income-category `Activity` | Income categories only |
| Banner **Assigned** | `plan.totalAssigned` | Σ non-income Assigned |
| Banner **Ready to Assign** | `plan.rta` | `incomeToRta − totalAssigned − nextHeld` |

Audit (2026-09): engine identity matches docs and tests (`income − assigned = rta` when hold/debt are zero). No formula change required.

**Import ignore rules:** transactions whose notes match an `ImportCategoryRule` with `ignore: true` set `excludeFromRta` and do **not** change RTA or category Activity (used for ING credit-line covers, etc.).

UI states:

| RTA | Meaning | Color |
|-----|---------|-------|
| `> 0` | Money left to give a job | accent / amber |
| `= 0` | Fully assigned | ok / green |
| `< 0` | Over-assigned | danger / red |

Zero-based goal: drive RTA to **0**.

### Quick assign (desktop)

| Control | Effect |
|---------|--------|
| **+** | Cover overspend (raise Assigned until Available ≥ 0) |
| **−** | Release Available back toward RTA (lower Assigned) |
| **=** | Assign all current RTA into this category |

---

## Plan UI: Spending & Accounts

### Spending section (desktop, after Income)

- **Spent this month** = `−Σ Activity(c)` for all non-income categories (display as positive).
- Total links to `/transactions?month=YYYY-MM&flow=spending`.
- Rows are **category groups only** (not individual categories — those stay under Categories).
- Each group total links to `/transactions?groupId=…&month=YYYY-MM`.

The **Categories** block below remains the assign / Available UI (unchanged).

### Accounts · income / groups / remaining

Per on-budget account for month `M` (`src/lib/plan-account-flows.ts`):

```
Income(A, M)    = Σ amount where account=A and (income category
                  OR categoryId is null OR isStartingBalance)
                  // same skip rules as Activity; aligns with incomeToRta
Spending(A, M)  = Σ amount where account=A, non-income category (usually ≤ 0)
                  // broken out by category group on the Plan Accounts table
Remaining(A, M) = Σ all txn amounts on A with date ≤ end of M   // cumulative balance
```

Negative statement balance adjustments are uncategorized and therefore count in **Income(A, M)**
(and RTA), not in Spending.

UI shows spending group columns as magnitude `−amount`. Links:

| Column | Href |
|--------|------|
| Income | `/transactions?accountId=&month=&flow=income` |
| Group | `/transactions?accountId=&groupId=&month=` |
| Remaining | `/accounts/{id}` |

### Transaction activity filters

`/transactions` activity view when `month` is set with `categoryId` and/or `flow`:

| Params | Filter |
|--------|--------|
| `categoryId` + `month` | That category in month (Plan Activity) |
| `groupId` + `month` | All categories in that group for the month |
| `flow=income` + `month` | Income categories **or** uncategorized **or** starting balance |
| `flow=spending` + `month` | Non-income categories in month |
| `+ accountId` | Restrict to one account |

Common rules: `isParent=false`, `transferTwinId=null`, `account.onBudget=true`, date in month.

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
