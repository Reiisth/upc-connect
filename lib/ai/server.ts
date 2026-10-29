import "server-only";
import { unstable_rethrow } from "next/navigation";
import { requirePermission } from "@/lib/permissions-server";
import { getAnalyticsBranchOptions, getAnalyticsOverview } from "@/lib/analytics/server";
import { getGeminiServerConfig } from "./config";
import { DecisionSupportError, decisionSupportFailure, type DecisionSupportErrorCode } from "./errors";
import { validateDecisionSupportFilters } from "./filters";
import { buildDecisionSupportInput } from "./input";
import { DECISION_SUPPORT_PROMPT_VERSION } from "./prompts/decision-support";
import { requestGeminiDecisionSupport } from "./provider";
import { validateDecisionSupportResponse } from "./validate-response";
import type { DecisionSupportResult } from "./types";

/** Explicit invocation only. Accept filters, never posted analytics or a client-supplied prompt. */
export async function generateDecisionSupportInsights(filters: unknown = {}): Promise<DecisionSupportResult> {
  // Preserve the portal's normal login/access-denied redirects before reading configuration or data.
  await requirePermission("reports.view");
  let fallbackCode: DecisionSupportErrorCode = "ANALYTICS_UNAVAILABLE";
  try {
    const request = validateDecisionSupportFilters(filters);
    const branches = await getAnalyticsBranchOptions();
    if (request.branchId && !branches.some((branch) => branch.id === request.branchId)) return decisionSupportFailure("BRANCH_NOT_ACCESSIBLE");
    if (!branches.length) return decisionSupportFailure("NO_BRANCH_ACCESS");
    const config = getGeminiServerConfig();
    const analytics = await getAnalyticsOverview(request);
    const input = buildDecisionSupportInput(analytics, request.branchId ? "one_accessible_branch" : "all_accessible_branches");
    fallbackCode = "PROVIDER_UNAVAILABLE";
    const raw = await requestGeminiDecisionSupport(input, config);
    fallbackCode = "INVALID_RESPONSE";
    const validated = validateDecisionSupportResponse(raw, input);
    return { ok: true, ...validated, advisory: true, promptVersion: DECISION_SUPPORT_PROMPT_VERSION,
      model: config.model, generatedAt: new Date().toISOString(), reportingContext: input.reportingContext,
      branchLabels: analytics.branches.map((row, index) => ({ label: input.branches[index].label, displayName: row.branch.name })),
    };
  } catch (error) {
    unstable_rethrow(error);
    const code = error instanceof DecisionSupportError ? error.code : fallbackCode;
    // Deliberately exclude provider/analytics errors, keys, payloads, prompts and responses from logs.
    console.warn("Decision support request failed", { code });
    return decisionSupportFailure(code);
  }
}
