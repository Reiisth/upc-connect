import "server-only";
import { requirePermission } from "@/lib/permissions-server";
import { getUserBranchScope } from "@/lib/branch-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateWeeklyInactivity, type MemberInactivitySummary } from "@/lib/inactivity/calculate";
import { analyticsToday, resolveAnalyticsDateRange, validAnalyticsDate, validateAnalyticsGrouping } from "./date-range";
import { assembleAnalytics, emptyAnalyticsAggregates } from "./assemble";
import type { AnalyticsAggregates, AnalyticsBranch, AnalyticsOverview, AnalyticsRequest } from "./types";

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function allRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw error;
    rows.push(...data ?? []);
    if (!data || data.length < 500) return rows;
  }
}

/** No module-specific permission gates: Reports permission and scope are validated by the sole public entry point. */
async function loadInactivityInputs(admin: ReturnType<typeof createAdminClient>, branches: readonly AnalyticsBranch[], today: string): Promise<MemberInactivitySummary[]> {
  const ids = branches.filter((branch) => branch.isActive).map((branch) => branch.id);
  if (!ids.length) return [];
  const members = await allRows((from, to) => admin.from("members").select("id, church_branch_id, first_attendance_date")
    .in("church_branch_id", ids).eq("is_archived", false).order("id").range(from, to));
  const earliest = members.map((row) => row.first_attendance_date as string | null)
    .filter((date): date is string => Boolean(date && validAnalyticsDate(date) && date <= today)).sort()[0];
  const [services, attendance] = earliest ? await Promise.all([
    allRows((from, to) => admin.from("services").select("id, church_branch_id, service_date, status")
      .in("church_branch_id", ids).eq("status", "completed").gte("service_date", earliest).lte("service_date", today).order("id").range(from, to)),
    allRows((from, to) => admin.from("attendance_records")
      .select("id, member_id, service_id, attendance_status, services!inner(church_branch_id, status, service_date)")
      .in("services.church_branch_id", ids).eq("services.status", "completed").lte("services.service_date", today)
      .gte("services.service_date", earliest)
      .in("attendance_status", ["present", "late"]).order("id").range(from, to)),
  ]) : [[], []];
  return calculateWeeklyInactivity({
    members: members.map((row) => ({ id: row.id, branchId: row.church_branch_id, eligibilityDate: row.first_attendance_date })),
    services: services.map((row) => ({ id: row.id, branchId: row.church_branch_id, serviceDate: row.service_date, status: row.status })),
    attendance: attendance.map((row) => ({ memberId: row.member_id, serviceId: row.service_id, status: row.attendance_status })),
    thresholds: new Map(branches.map((branch) => [branch.id, branch.inactivityThresholdWeeks])), today,
  });
}

export async function getAnalyticsOverview(request: AnalyticsRequest = {}): Promise<AnalyticsOverview> {
  const access = await requirePermission("reports.view");
  const scope = await getUserBranchScope(access.user.id);
  const asOfDate = analyticsToday(new Date());
  const range = resolveAnalyticsDateRange(request.range, asOfDate);
  const grouping = request.grouping ?? "week";
  validateAnalyticsGrouping(grouping);
  if (request.branchId !== undefined && !scope.branchIds.includes(request.branchId)) throw new Error("The selected reporting branch is outside your access.");
  const ids = request.branchId ? [request.branchId] : [...new Set(scope.branchIds)];
  try {
    const admin = createAdminClient();
    const branchRows = ids.length ? await allRows((from, to) => admin.from("church_branches")
      .select("id, name, code, is_active, inactivity_threshold_weeks").in("id", ids).order("id").range(from, to)) : [];
    const branches: AnalyticsBranch[] = branchRows.map((row) => ({ id: row.id, name: row.name, code: row.code,
      isActive: row.is_active, inactivityThresholdWeeks: row.inactivity_threshold_weeks }));
    if (request.branchId && !branches.length) throw new Error("Reporting branch no longer exists.");
    if (!branches.length) return assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches, inactivity: [], range, grouping, asOfDate });
    const [{ data, error }, inactivity] = await Promise.all([
      admin.rpc("get_reports_analytics", { p_branch_ids: branches.map((branch) => branch.id), p_from: range.from, p_to: range.to, p_grouping: grouping, p_as_of: asOfDate }),
      loadInactivityInputs(admin, branches, asOfDate),
    ]);
    if (error) throw error;
    if (!data || data.version !== 1) throw new Error("Analytics aggregation migration is unavailable or incompatible.");
    return assembleAnalytics({ aggregates: data as AnalyticsAggregates, branches, inactivity, range, grouping, asOfDate });
  } catch (error) {
    console.error("Analytics load failed", error);
    throw new Error("Unable to load reporting data. Verify the analytics migration is applied and try again.");
  }
}
