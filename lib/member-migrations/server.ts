import { getPortalBranchId } from "@/lib/portal-branch-server";
import "server-only";
import { requirePermission } from "@/lib/permissions-server";
import { getUserBranchScope } from "@/lib/branch-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";
import { resolveAnalyticsDateRange, validateAnalyticsGrouping } from "@/lib/analytics/date-range";
import type { AnalyticsRequest } from "@/lib/analytics/types";

export type MigrationTotals = { events: number; members: number; transfers: number; incoming: number; outgoing: number; departures: number; returns: number; net: number };
export type MigrationAnalytics = {
  trackingStartedAt: string; totals: MigrationTotals;
  trend: { periodStart: string; incoming: number; outgoing: number; departures: number; returns: number }[];
  branches: { id: string; name: string; incoming: number; outgoing: number; departures: number; returns: number; net: number }[];
  flows: { source: string; destination: string; transfers: number }[];
};

export async function getMigrationReportingContext() {
  const access = await requirePermission("reports.view");
  const scope = await getUserBranchScope(access.user.id);
  const admin = createAdminClient();
  const branches = await getHistoricalRecordBranches(scope, admin);
  return { access, admin, branches };
}

export async function getMigrationAnalytics(request: AnalyticsRequest = {}): Promise<MigrationAnalytics> {
  const { access, admin, branches } = await getMigrationReportingContext();
  const selectedBranch = await getPortalBranchId();
  if (selectedBranch && request.branchId && selectedBranch !== request.branchId) throw new Error("The current branch has changed. Refresh and try again.");
  request = {...request,branchId:selectedBranch ?? request.branchId};
  if (request.branchId && !branches.some(branch => branch.id === request.branchId)) throw new Error("Selected branch is outside your access.");
  const range = resolveAnalyticsDateRange(request.range);
  const grouping = request.grouping ?? "week";
  validateAnalyticsGrouping(grouping);
  if (Date.parse(range.to) - Date.parse(range.from) > 3660 * 86400000) throw new Error("Choose a reporting range of ten years or less.");
  const { data, error } = await admin.rpc("get_member_migration_analytics", {
    p_actor_id: access.user.id, p_branch_ids: branches.filter(branch => !request.branchId || branch.id === request.branchId).map(branch => branch.id),
    p_from: range.from, p_to: range.to, p_grouping: grouping,
  });
  if (error || !data || !data.totals || !data.trackingStartedAt) throw new Error("Migration analytics could not be loaded. Check that the migration is applied and try again.");
  return data as MigrationAnalytics;
}

export type MigrationEvent = { id: string; member_id: string; member_name: string; kind: "transfer" | "departure" | "return"; recorded_at: string; from_branch_name: string | null; to_branch_name: string | null };

/** Historical event scope, independent of the member's current branch. Never grants access to their current profile. */
export async function getMemberMigrationHistory(memberId: string, page = 1) {
  return getMigrationEvents({ memberId, page });
}

export async function getMigrationEvents(filters: { memberId?: string; page?: number; search?: string; kind?: string; branch?: string; from?: string; to?: string } = {}) {
  const access = await requirePermission("members.view");
  const scope = await getUserBranchScope(access.user.id);
  const admin = createAdminClient();
  const branches = await getHistoricalRecordBranches(scope, admin);
  const ids = branches.map(branch => branch.id);
  filters = {...filters,branch:(await getPortalBranchId()) ?? filters.branch};
  const currentPage = Number.isSafeInteger(filters.page) && filters.page! > 0 ? Math.min(filters.page!,100000) : 1;
  if (filters.kind && !["transfer","departure","return"].includes(filters.kind)) throw new Error("Select a valid movement type.");
  if (filters.branch && !ids.includes(filters.branch)) throw new Error("Selected branch is outside your access.");
  if (filters.from || filters.to) resolveAnalyticsDateRange({ preset: "custom", from: filters.from ?? "0001-01-01", to: filters.to ?? "9999-12-31" });
  if (!ids.length) return { rows: [] as MigrationEvent[], total: 0, page: 1 };
  // Branch IDs come from trusted database scope, never directly from URL input.
  const selected = filters.branch ? [filters.branch] : ids;
  let query = admin.from("member_migrations").select("id,member_id,member_name,kind,recorded_at,from_branch_id,to_branch_id,from_branch_name,to_branch_name", { count: "exact" })
    .or(`from_branch_id.in.(${selected.join(",")}),to_branch_id.in.(${selected.join(",")})`);
  if (filters.memberId) query = query.eq("member_id",filters.memberId);
  if (filters.kind) query = query.eq("kind",filters.kind);
  if (filters.search?.trim()) query = query.ilike("member_name",`%${filters.search.trim().slice(0,100).replace(/[\\%_]/g,"\\$&")}%`);
  if (filters.from) query = query.gte("recorded_at",`${filters.from}T00:00:00+08:00`);
  if (filters.to) query = query.lte("recorded_at",`${filters.to}T23:59:59.999999+08:00`);
  const { data, count, error } = await query.order("recorded_at", { ascending: false }).order("id").range((currentPage - 1) * 10, currentPage * 10 - 1);
  if (error) throw new Error("Migration history could not be loaded.");
  const pages = Math.max(1, Math.ceil((count ?? 0) / 10));
  if (currentPage > pages) return getMigrationEvents({ ...filters, page: pages });
  const rows: MigrationEvent[] = (data ?? []).map(row => ({
    id: row.id, member_id: row.member_id, member_name: row.member_name, kind: row.kind, recorded_at: row.recorded_at,
    from_branch_name: row.from_branch_id && !ids.includes(row.from_branch_id) ? "Outside accessible branches" : row.from_branch_name,
    to_branch_name: row.to_branch_id && !ids.includes(row.to_branch_id) ? "Outside accessible branches" : row.to_branch_name,
  }));
  return { rows, total: count ?? 0, page: currentPage };
}
