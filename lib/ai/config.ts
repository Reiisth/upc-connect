import "server-only";
import { DecisionSupportError } from "./errors";

// Stable model with structured output support; see README for the reviewed official sources.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DECISION_SUPPORT_TIMEOUT_MS = 30_000;
export const DECISION_SUPPORT_MAX_INPUT_BYTES = 100_000;
export const DECISION_SUPPORT_MAX_OUTPUT_CHARS = 24_000;
export const DECISION_SUPPORT_MAX_OUTPUT_TOKENS = 4_096;
export type GeminiServerConfig = { apiKey: string; model: string; timeoutMs: number };

/** Read at invocation, so builds and ordinary Reports requests do not require a key. */
export function getGeminiServerConfig(): GeminiServerConfig {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new DecisionSupportError("NOT_CONFIGURED");
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/^gemini-[a-z0-9][a-z0-9._-]{0,100}$/.test(model)) throw new DecisionSupportError("INVALID_CONFIGURATION");
  return { apiKey, model, timeoutMs: DECISION_SUPPORT_TIMEOUT_MS };
}
