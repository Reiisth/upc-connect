import { manilaDate } from "../inactivity/calculate";
import type { AnalyticsDateRange, AnalyticsGrouping, AnalyticsRangeInput } from "./types";

export { manilaDate as analyticsToday };
export function validAnalyticsDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

/** Inclusive local calendar dates; seven days includes today plus six preceding dates. */
export function resolveAnalyticsDateRange(input: AnalyticsRangeInput = { preset: "last_30_days" }, today = manilaDate(new Date())): AnalyticsDateRange {
  if (!validAnalyticsDate(today)) throw new Error("Invalid analytics reference date.");
  let from: string, to = today;
  switch (input.preset) {
    case "custom": from = input.from; to = input.to; break;
    case "year_to_date": from = `${today.slice(0, 4)}-01-01`; break;
    case "last_7_days": case "last_30_days": case "last_90_days": {
      const days = { last_7_days: 7, last_30_days: 30, last_90_days: 90 }[input.preset];
      from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
      break;
    }
    default: throw new Error("Unsupported analytics date preset.");
  }
  if (!validAnalyticsDate(from) || !validAnalyticsDate(to) || from > to) throw new Error("Enter a valid reporting date range with start on or before end.");
  return { from, to, timeZone: "Asia/Manila" };
}

export function validateAnalyticsGrouping(value: string): asserts value is AnalyticsGrouping {
  if (!["day", "week", "month"].includes(value)) throw new Error("Unsupported analytics grouping.");
}
