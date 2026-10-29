import { resolveAnalyticsDateRange, validateAnalyticsGrouping } from "@/lib/analytics/date-range";
import type { AnalyticsGrouping, AnalyticsRangeInput, AnalyticsRequest } from "@/lib/analytics/types";

export const REPORT_PRESETS = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "year_to_date", label: "Year to Date" },
  { value: "custom", label: "Custom" },
] as const;
type Preset = typeof REPORT_PRESETS[number]["value"];
export type ReportFilterValues = { branch: string; preset: Preset; from: string; to: string; grouping: AnalyticsGrouping };
export type ReportSearchParams = Record<string, string | string[] | undefined>;

/** Validate URL inputs before calling the authenticated analytics entry. Scope is checked separately on the server. */
export function parseReportFilters(params: ReportSearchParams, today: string): {
  values: ReportFilterValues; request: AnalyticsRequest | null; error: string | null;
} {
  const defaults = resolveAnalyticsDateRange(undefined, today);
  const read = (key: string) => Array.isArray(params[key]) ? params[key][0] : params[key];
  const rawPreset = read("range") || "last_30_days";
  const preset = REPORT_PRESETS.find((item) => item.value === rawPreset)?.value ?? "last_30_days";
  const rawGrouping = read("grouping") || "week";
  const grouping = ["day", "week", "month"].includes(rawGrouping) ? rawGrouping as AnalyticsGrouping : "week";
  const branch = (read("branch") || "").toLowerCase();
  const values: ReportFilterValues = { branch, preset, grouping, from: read("from") ?? defaults.from, to: read("to") ?? defaults.to };
  try {
    if (["branch", "range", "from", "to", "grouping"].some((key) => Array.isArray(params[key]))) throw new Error("Use one value for each report filter.");
    if (branch && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(branch)) throw new Error("Choose an accessible reporting branch.");
    if (rawPreset !== preset) throw new Error("Choose a valid reporting date preset.");
    validateAnalyticsGrouping(rawGrouping);
    if (preset === "custom" && (!read("from") || !read("to"))) throw new Error("Enter both custom reporting dates.");
    const range: AnalyticsRangeInput = preset === "custom" ? { preset, from: values.from, to: values.to } : { preset };
    const resolved = resolveAnalyticsDateRange(range, today);
    if (preset !== "custom") { values.from = resolved.from; values.to = resolved.to; }
    return { values, request: { range, grouping, ...(branch ? { branchId: branch } : {}) }, error: null };
  } catch (error) {
    return { values, request: null, error: error instanceof Error ? error.message : "Choose valid reporting filters." };
  }
}

export function reportFilterUrl(values: ReportFilterValues): string {
  const query = new URLSearchParams({ range: values.preset, grouping: values.grouping });
  if (values.branch) query.set("branch", values.branch);
  if (values.preset === "custom") { query.set("from", values.from); query.set("to", values.to); }
  return `/portal/reports?${query.toString()}`;
}
