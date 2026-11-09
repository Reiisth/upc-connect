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
    const details = error && typeof error === "object" ? error as { status?: unknown; statusCode?: unknown; name?: unknown; message?: unknown; code?: unknown; error?: unknown; body?: unknown } : {};
    if (details.status === 429 || details.statusCode === 429) throw new DecisionSupportError("RATE_LIMITED");
    if (details.status === 408 || details.statusCode === 408 || ["TimeoutError", "APIConnectionTimeoutError", "RequestTimeoutError"].includes(String(details.name))) throw new DecisionSupportError("TIMEOUT");
    // Match only known categories; never log or return the raw upstream message.
    const body = details.error && typeof details.error === "object" ? details.error as { message?: unknown; error?: unknown; body?: unknown } : {};
    const nested = body.error && typeof body.error === "object" ? body.error as { message?: unknown } : {};
    const message = [details.message, body.message, nested.message, details.body, typeof details.error === "string" ? details.error : JSON.stringify(details.error)].filter((value): value is string => typeof value === "string").join(" ");
    if (/location.*not supported|unsupported.*location|country.*not supported|not available.*(region|country)|region.*not supported/i.test(message)) throw new DecisionSupportError("PROVIDER_REGION");
    if (/leaked|compromised/i.test(message)) throw new DecisionSupportError("PROVIDER_KEY_LEAKED");
    if (/api.?key.*expired|API_KEY_EXPIRED/i.test(message)) throw new DecisionSupportError("PROVIDER_KEY_EXPIRED");
    if (/API_KEY_INVALID|api.?key.*(not valid|invalid|not found)|invalid api.?key/i.test(message)) throw new DecisionSupportError("PROVIDER_KEY_INVALID");
    if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|API_KEY_ANDROID_APP_BLOCKED|API_KEY_IOS_APP_BLOCKED|referer|referrer|ip address.*blocked|api.*restriction/i.test(message)) throw new DecisionSupportError("PROVIDER_KEY_RESTRICTED");
    if ([401, 403].includes(Number(details.status ?? details.statusCode)) || /api.?key|api_key|authentication|credential/i.test(message)) throw new DecisionSupportError("PROVIDER_AUTHENTICATION");
    if (Number(details.status ?? details.statusCode) === 404) throw new DecisionSupportError("MODEL_UNAVAILABLE");
    if (Number(details.status ?? details.statusCode) === 400) {
      if (/schema|response.format|response_format/i.test(message)) throw new DecisionSupportError("PROVIDER_SCHEMA");
      if (/model/i.test(message)) throw new DecisionSupportError("MODEL_UNAVAILABLE");
      throw new DecisionSupportError("PROVIDER_REJECTED");
    }
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network error|connection error/i.test(message)) throw new DecisionSupportError("PROVIDER_CONNECTION");
    throw new DecisionSupportError("PROVIDER_UNAVAILABLE");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
