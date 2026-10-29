import { validAnalyticsDate } from "@/lib/analytics/date-range";

export function formatReportNumber(value: number | null, maximumFractionDigits = 2): string {
  return value === null || !Number.isFinite(value) ? "Unavailable" : value.toLocaleString("en-PH", { maximumFractionDigits });
}
export function formatReportPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Unavailable" : `${formatReportNumber(value, 1)}%`;
}
export function formatReportDate(value: string): string {
  return validAnalyticsDate(value) ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })
    .format(new Date(`${value}T00:00:00+08:00`)) : "Unavailable";
}

/** Aggregate amounts can exceed the operational single-record safe-cent formatter. Never parse as Number. */
export function formatReportMoney(value: string | null): string {
  const match = value === null ? null : /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "Unavailable";
  const whole = match[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₱${whole}.${(match[2] ?? "").padEnd(2, "0")}`;
}

/** Formatting coordinates only: integer ratios on a relative 0–100 axis; original money stays exact in tooltips/tables. */
export function relativeMoneyCoordinates(series: readonly (readonly (string | null)[])[]): number[][] {
  const cents = series.map((values) => values.map((value) => {
    const match = value === null ? null : /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    return match ? BigInt(`${match[1]}${(match[2] ?? "").padEnd(2, "0")}`) : BigInt(0);
  }));
  const largest = cents.flat().reduce((max, value) => value > max ? value : max, BigInt(0));
  return cents.map((values) => values.map((value) => largest === BigInt(0) ? 0 : Number(value * BigInt(10000) / largest) / 100));
}
