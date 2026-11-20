import type { AnalyticsDateRange, AnalyticsGrouping, TimeSeriesPoint } from "./types";

function bucket(date: string, grouping: AnalyticsGrouping) {
  const instant=new Date(`${date}T00:00:00Z`),day=Math.floor(instant.getTime()/86400000);
  return grouping === "month" ? instant.getUTCFullYear()*12+instant.getUTCMonth() : grouping === "week" ? Math.floor((day+3)/7) : day;
}

/** Dates match the exact bucket ends, including compressed long-range points. The first is a pre-range baseline. */
export function membershipSparklineDates(range:AnalyticsDateRange,grouping:AnalyticsGrouping):string[] {
  const first=bucket(range.from,grouping),last=bucket(range.to,grouping);
  if (!Number.isFinite(first)||!Number.isFinite(last)||last<first) return [];
  const step=Math.ceil((last-first+1)/64);
  return [range.from,...Array.from({length:Math.ceil((last-first+1)/step)},(_,index)=>{
    const end=Math.min(last,first+(index+1)*step-1);
    const date=grouping === "month" ? new Date(0) : new Date((grouping === "week" ? end*7+3 : end)*86400000);
    if (grouping === "month") {date.setUTCFullYear(Math.floor(end/12),end%12+1,0);date.setUTCHours(0,0,0,0);}
    return new Date(Math.min(date.getTime(),Date.parse(`${range.to}T00:00:00Z`))).toISOString().slice(0,10);
  })];
}

/** Fill quiet periods; bound the miniature chart even for very long custom ranges. */
export function registrationSparkline(trend: readonly TimeSeriesPoint[], range: AnalyticsDateRange, grouping: AnalyticsGrouping): number[] {
  const first = bucket(range.from,grouping), last = bucket(range.to,grouping);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
  const step = Math.ceil((last - first + 1) / 64);
  const values = Array<number>(Math.ceil((last - first + 1) / step)).fill(0);
  for (const point of trend) {
    const index = bucket(point.periodStart,grouping);
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
