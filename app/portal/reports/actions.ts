"use server";

import { generateDecisionSupportInsights } from "@/lib/ai/server";
import type { DecisionSupportResult } from "@/lib/ai/types";

/** Untrusted filter intent only; authorization, validation and generation stay in the server foundation. */
export async function generateReportInsights(filters: unknown): Promise<DecisionSupportResult> {
  return generateDecisionSupportInsights(filters);
}
