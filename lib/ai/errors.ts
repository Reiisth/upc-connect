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
  PROVIDER_AUTHENTICATION: "The AI provider rejected the server API key or its access restrictions. Contact your administrator.",
  MODEL_UNAVAILABLE: "The configured AI model is unavailable to this deployment. Contact your administrator.",
  PROVIDER_REGION: "The AI provider does not support this server location. Contact your administrator.",
  PROVIDER_SCHEMA: "The AI provider rejected the report response schema. Contact your administrator.",
  PROVIDER_REJECTED: "The AI provider rejected the server request configuration. Contact your administrator.",
  PROVIDER_CONNECTION: "The server could not connect to the AI provider. Please try again later.",
  PROVIDER_UNAVAILABLE: "AI insights could not be generated. Please try again later.",
  INVALID_RESPONSE: "The AI response could not be verified. Please try again.",
  COOLDOWN: "Insights were requested recently for these report filters. Please try again shortly.",
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
