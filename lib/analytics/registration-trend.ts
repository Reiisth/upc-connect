import type { AnalyticsDateRange, AnalyticsGrouping, TimeSeriesPoint } from "./types";

/** Fill quiet periods; bound the miniature chart even for very long custom ranges. */
export function registrationSparkline(trend: readonly TimeSeriesPoint[], range: AnalyticsDateRange, grouping: AnalyticsGrouping): number[] {
  function bucket(date: string) {
    const instant = new Date(`${date}T00:00:00Z`);
    const day = Math.floor(instant.getTime() / 86400000);
    return grouping === "month" ? instant.getUTCFullYear() * 12 + instant.getUTCMonth()
      : grouping === "week" ? Math.floor((day + 3) / 7) : day;
  }
  const first = bucket(range.from), last = bucket(range.to);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
  const step = Math.ceil((last - first + 1) / 64);
  const values = Array<number>(Math.ceil((last - first + 1) / step)).fill(0);
  for (const point of trend) {
    const index = bucket(point.periodStart);
    if (index >= first && index <= last && Number.isFinite(point.value) && point.value >= 0) {
      values[Math.floor((index - first) / step)] += point.value;
    }
  }
  return values;
}

/** Start with earlier registrations and carry each period's additions forward. */
export function cumulativeMembershipSparkline(trend: readonly TimeSeriesPoint[], range: AnalyticsDateRange, grouping: AnalyticsGrouping, totalAtEnd: number): number[] {
  const additions = registrationSparkline(trend, range, grouping);
  let total = Math.max(0, totalAtEnd - additions.reduce((sum, value) => sum + value, 0));
  return [total, ...additions.map(value => { total += value; return total; })];
}
