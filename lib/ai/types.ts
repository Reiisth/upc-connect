import type { z } from "zod";
import type { decisionSupportInputSchema, decisionSupportInsightSchema } from "./schemas";
import type { DecisionSupportErrorCode } from "./errors";

export type DecisionSupportInput = z.infer<typeof decisionSupportInputSchema>;
export type DecisionSupportInsight = z.infer<typeof decisionSupportInsightSchema>;
export type DecisionSupportScopeMode = DecisionSupportInput["reportingContext"]["branchScope"]["mode"];
export type DecisionSupportEvidence = { path: string; value: string | number | boolean | null };
export type DecisionSupportDisplayEvidence = DecisionSupportEvidence & {
  /** Deterministic server label, including relevant branch, bucket or category context. */
  label: string;
  format: "number" | "money" | "percent" | "date" | "text";
};
export type DecisionSupportResult = {
  ok: true;
  insight: DecisionSupportInsight;
  advisory: true;
  promptVersion: string;
  model: string;
  generatedAt: string;
  reportingContext: DecisionSupportInput["reportingContext"];
  /** Returned only to the authorized caller; display names are never sent to Gemini. */
  branchLabels: { label: string; displayName: string }[];
  /** Values resolved by the server from cited aggregate paths, never supplied by the model. */
  evidence: DecisionSupportDisplayEvidence[];
} | { ok: false; error: { code: DecisionSupportErrorCode; message: string } };
