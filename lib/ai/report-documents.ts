import "server-only";
import { requirePermission } from "@/lib/permissions-server";
import { getAnalyticsBranchOptions } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDecisionSupportFilters } from "./filters";
import type { DecisionSupportResult } from "./types";

export type SavedReportResult = Extract<DecisionSupportResult, { ok: true }>;
export type ReportDocumentRow = { id: string; created_at: string; description: string };

async function context() {
  const { user } = await requirePermission("reports.view");
  const branches = await getAnalyticsBranchOptions();
  return { user, branches, admin: createAdminClient() };
}

/** Only call with the validated provider result produced in this server request. */
export async function saveReportDocument(result: SavedReportResult, filters: unknown) {
  const { user, branches, admin } = await context();
  const request = validateDecisionSupportFilters(filters);
  const ids = branches.filter(branch => !request.branchId || branch.id === request.branchId).map(branch => branch.id);
  if (!ids.length || ids.length !== result.branchLabels.length || branches.filter(branch => ids.includes(branch.id)).some(branch => !result.branchLabels.some(label => label.displayName === branch.name))) throw new Error("Report scope changed before saving.");
  const description = `${result.reportingContext.dateRange.from} to ${result.reportingContext.dateRange.to}: ${result.insight.executiveSummary}`.slice(0, 350);
  const { data, error } = await admin.from("ai_report_documents").insert({
    created_by: user.id, branch_ids: ids, description, result,
  }).select("id").single();
  if (error || !data) throw new Error("Unable to save report document.");
  return data.id as string;
}

export async function listReportDocuments(page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error("Invalid document page.");
  const { user, branches, admin } = await context();
  if (!branches.length) return { rows: [] as ReportDocumentRow[], total: 0 };
  const { data, error, count } = await admin.from("ai_report_documents")
    .select("id, created_at, description", { count: "exact" })
    .eq("created_by", user.id).containedBy("branch_ids", branches.map(branch => branch.id))
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 5, page * 5 - 1);
  if (error) throw new Error("Saved reports could not be loaded.");
  return { rows: (data ?? []) as ReportDocumentRow[], total: count ?? 0 };
}

export async function getReportDocument(id: string) {
  const { user, branches, admin } = await context();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !branches.length) return null;
  const { data, error } = await admin.from("ai_report_documents").select("id, created_at, description, result")
    .eq("id", id).eq("created_by", user.id).containedBy("branch_ids", branches.map(branch => branch.id)).maybeSingle();
  if (error) throw new Error("Saved report could not be loaded.");
  return data ? { ...data, result: data.result as SavedReportResult } : null;
}
