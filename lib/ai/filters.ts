import "server-only";
import { analyticsToday, resolveAnalyticsDateRange, validateAnalyticsGrouping } from "@/lib/analytics/date-range";
import type { AnalyticsRequest } from "@/lib/analytics/types";
import { DecisionSupportError } from "./errors";
import { decisionSupportFiltersSchema } from "./schemas";

export function validateDecisionSupportFilters(value: unknown = {}): AnalyticsRequest {
  const parsed = decisionSupportFiltersSchema.safeParse(value);
  if (!parsed.success) throw new DecisionSupportError("INVALID_FILTERS");
  try {
    const range = resolveAnalyticsDateRange(parsed.data.range, analyticsToday(new Date()));
    const grouping = parsed.data.grouping ?? "week";
    validateAnalyticsGrouping(grouping);
    // Equivalent presets/custom dates share a cooldown and cannot drift during the request.
    return { ...parsed.data, range: { preset: "custom", from: range.from, to: range.to }, grouping };
  } catch {
    throw new DecisionSupportError("INVALID_FILTERS");
  }
}
