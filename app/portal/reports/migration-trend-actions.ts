"use server";

import { unstable_rethrow } from "next/navigation";
import { getMigrationAnalytics } from "@/lib/member-migrations/server";
import type { AnalyticsRequest } from "@/lib/analytics/types";

/** The reporting loader rechecks permission, global branch scope and dates. */
export async function loadMigrationTrend(request: AnalyticsRequest) {
  try {
    const data = await getMigrationAnalytics(request);
    return { ok: true as const, trend: data.trend };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false as const, error: "Branch movements could not be loaded. Please try again." };
  }
}
