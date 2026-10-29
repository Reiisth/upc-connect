import "server-only";

export const DECISION_SUPPORT_ERRORS = {
  INVALID_FILTERS: "Choose valid report branch, date, and grouping filters.",
  BRANCH_NOT_ACCESSIBLE: "The selected reporting branch is outside your access.",
  NO_BRANCH_ACCESS: "No accessible reporting branches are available.",
  NOT_CONFIGURED: "AI insights are not configured. Contact your administrator.",
  INVALID_CONFIGURATION: "AI insights are temporarily unavailable because of a server configuration issue.",
  ANALYTICS_UNAVAILABLE: "Report data could not be loaded for AI insights. Please try again.",
  PAYLOAD_TOO_LARGE: "This report is too large for AI insights. Choose a shorter date range, fewer branches, or a coarser grouping.",
  RATE_LIMITED: "AI insights are temporarily rate limited. Please try again later.",
  TIMEOUT: "AI insights took too long to generate. Please try again later.",
  PROVIDER_UNAVAILABLE: "AI insights could not be generated. Please try again later.",
  INVALID_RESPONSE: "The AI response could not be verified. Please try again.",
} as const;
export type DecisionSupportErrorCode = keyof typeof DECISION_SUPPORT_ERRORS;

/** Contains only a fixed user-safe message, never a provider error or prompt. */
export class DecisionSupportError extends Error {
  constructor(readonly code: DecisionSupportErrorCode) {
    super(DECISION_SUPPORT_ERRORS[code]);
    this.name = "DecisionSupportError";
  }
}

export function decisionSupportFailure(code: DecisionSupportErrorCode) {
  return { ok: false as const, error: { code, message: DECISION_SUPPORT_ERRORS[code] } };
}
