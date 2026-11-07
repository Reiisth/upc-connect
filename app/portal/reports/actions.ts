"use server";

import { generateDecisionSupportInsights } from "@/lib/ai/server";
import { unstable_rethrow } from "next/navigation";
import { listReportDocuments, saveReportDocument } from "@/lib/ai/report-documents";
import type { DecisionSupportResult } from "@/lib/ai/types";

/** Untrusted filter intent only; authorization, validation and generation stay in the server foundation. */
export async function generateReportInsights(filters: unknown): Promise<DecisionSupportResult> {
  const result = await generateDecisionSupportInsights(filters);
  if (!result.ok) return result;
  try { return { ...result, documentId: await saveReportDocument(result, filters) }; }
  catch (error) {
    unstable_rethrow(error);
    return { ...result, documentWarning: "Insights were generated, but the report document could not be saved. Please try generating again." };
  }
}

export async function getSavedReportDocuments(page: number) {
  try { return { ok: true as const, ...await listReportDocuments(page) }; }
  catch (error) { unstable_rethrow(error); return { ok: false as const, error: "Saved reports could not be loaded. Please try again." }; }
}
