import "server-only";
import type { AnalyticsRequest } from "@/lib/analytics/types";
import { DecisionSupportError } from "./errors";

const COOLDOWN_MS = 30_000;
const MAX_ENTRIES = 10_000;
export function createDecisionSupportCooldown(clock: () => number = Date.now) {
  // Process-local metadata only: no insights, prompts, payloads or provider responses.
  const attempts = new Map<string, { expiresAt: number; pending: boolean }>();
  /** Claim synchronously before awaiting analytics/provider work, including concurrent requests. */
  return (userId: string, request: AnalyticsRequest): (() => void) => {
    // The caller supplies validated, normalized custom dates and the default grouping.
    if (request.range?.preset !== "custom") throw new DecisionSupportError("INVALID_FILTERS");
    const now = clock();
    for (const [key, attempt] of attempts) {
      if (!attempt.pending && attempt.expiresAt <= now) attempts.delete(key);
    }
    const key = JSON.stringify([userId, request.branchId ?? null, request.range.from, request.range.to, request.grouping]);
    if (attempts.has(key) || attempts.size >= MAX_ENTRIES) throw new DecisionSupportError("COOLDOWN");
    const attempt = { expiresAt: now + COOLDOWN_MS, pending: true };
    attempts.set(key, attempt);
    return () => { attempt.pending = false; };
  };
}

export const claimDecisionSupportGeneration = createDecisionSupportCooldown();
