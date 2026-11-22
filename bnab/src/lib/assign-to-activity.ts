/**
 * Assigned that exactly funds this month’s Activity.
 * Spend outflows are negative → Assigned = −Activity; refunds/zero → 0.
 */
export function assignedMatchingActivity(activity: number): number {
  return Math.max(0, -activity);
}
