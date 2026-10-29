import "server-only";
import { GoogleGenAI } from "@google/genai";
import { DECISION_SUPPORT_MAX_OUTPUT_TOKENS, type GeminiServerConfig } from "./config";
import { DecisionSupportError } from "./errors";
import { buildDecisionSupportPrompt } from "./prompts/decision-support";
import { decisionSupportJsonSchema } from "./schemas";
import type { DecisionSupportInput } from "./types";

/** Purpose-built, stateless provider boundary. No tools, arbitrary prompts, conversation or persistence. */
export async function requestGeminiDecisionSupport(input: DecisionSupportInput, config: GeminiServerConfig): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new DecisionSupportError("TIMEOUT"));
    }, config.timeoutMs);
  });
  try {
    const client = new GoogleGenAI({ apiKey: config.apiKey, vertexai: false, httpOptions: { timeout: config.timeoutMs } });
    const prompt = buildDecisionSupportPrompt(input);
    const response = await Promise.race([
      client.interactions.create({
        model: config.model, store: false, background: false, stream: false, automatic_continuation: false,
        input: prompt.userContent, system_instruction: prompt.systemInstruction, tools: [],
        generation_config: { max_output_tokens: DECISION_SUPPORT_MAX_OUTPUT_TOKENS },
        response_format: { type: "text", mime_type: "application/json", schema: decisionSupportJsonSchema },
      }, { signal: controller.signal, timeout_ms: config.timeoutMs, retries: { strategy: "none" }, cache: "no-store" }),
      deadline,
    ]);
    if (response.status !== "completed" || typeof response.output_text !== "string" || !response.output_text.trim()) throw new DecisionSupportError("INVALID_RESPONSE");
    return response.output_text;
  } catch (error) {
    if (timedOut) throw new DecisionSupportError("TIMEOUT");
    if (error instanceof DecisionSupportError) throw error;
    const details = error && typeof error === "object" ? error as { status?: unknown; statusCode?: unknown; name?: unknown } : {};
    if (details.status === 429 || details.statusCode === 429) throw new DecisionSupportError("RATE_LIMITED");
    if (details.status === 408 || details.statusCode === 408 || ["TimeoutError", "APIConnectionTimeoutError", "RequestTimeoutError"].includes(String(details.name))) throw new DecisionSupportError("TIMEOUT");
    throw new DecisionSupportError("PROVIDER_UNAVAILABLE");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
