import type { AnalyticsOverview, MemberStatusHistory } from "./types";

/** A closing snapshot, never a sum of daily membership counts. */
export function memberStatusSnapshot(overview: AnalyticsOverview, history: MemberStatusHistory | null) {
  const date = overview.range.to < overview.asOfDate ? overview.range.to : overview.asOfDate;
  const point = history?.points.find(point => point.asOfDate === date);
  if (overview.range.from > overview.asOfDate) return { date, active: null, inactive: null };
  if (point) return { date, active: point.active, inactive: point.inactive };
  // Current counts remain usable if history is temporarily unavailable. Never
  // substitute current status for an unknown historical snapshot.
  return { date, active: date === overview.asOfDate ? overview.membership.storedActiveMembers : null,
    inactive: date === overview.asOfDate ? overview.membership.storedInactiveMembers : null };
}
