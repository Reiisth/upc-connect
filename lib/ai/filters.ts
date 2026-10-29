import "server-only";
import { analyticsToday, resolveAnalyticsDateRange, validateAnalyticsGrouping } from "@/lib/analytics/date-range";
import type { AnalyticsRequest } from "@/lib/analytics/types";
import { DecisionSupportError } from "./errors";
import { decisionSupportFiltersSchema } from "./schemas";

export function validateDecisionSupportFilters(value: unknown = {}): AnalyticsRequest {
  const parsed = decisionSupportFiltersSchema.safeParse(value);
  if (!parsed.success) throw new DecisionSupportError("INVALID_FILTERS");
  try {
    resolveAnalyticsDateRange(parsed.data.range, analyticsToday(new Date()));
    validateAnalyticsGrouping(parsed.data.grouping ?? "week");
  } catch {
    throw new DecisionSupportError("INVALID_FILTERS");
  }
  return parsed.data;
}
