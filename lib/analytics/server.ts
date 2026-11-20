import { getPortalBranchId } from "@/lib/portal-branch-server";
import { loadMonitoringParticipation } from "@/lib/inactivity/participation";
import "server-only";
import { cache } from "react";
import { requirePermission } from "@/lib/permissions-server";
import { getUserBranchScope } from "@/lib/branch-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateWeeklyInactivity, manilaDateFromTimestamp, type MemberInactivitySummary } from "@/lib/inactivity/calculate";
import { analyticsToday, resolveAnalyticsDateRange, validateAnalyticsGrouping } from "./date-range";
import { assembleAnalytics, emptyAnalyticsAggregates } from "./assemble";
import type { AnalyticsAggregates, AnalyticsBranch, AnalyticsOverview, AnalyticsRequest, MemberStatusHistory, MostAttendedService } from "./types";

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

/** Shared only within a server render; both public reads require Reports permission. */
const getAnalyticsContext = cache(async () => {
  const access = await requirePermission("reports.view");
  try {
    const scope = await getUserBranchScope(access.user.id);
    const admin = createAdminClient();
    const ids = [...new Set(scope.branchIds)];
    const selectedBranch = await getPortalBranchId();
    // System administrators may select a closed branch for historical reporting.
    if (scope.isSystemAdmin && selectedBranch && !ids.includes(selectedBranch)) ids.push(selectedBranch);
    const rows = ids.length ? await allRows((from, to) => admin.from("church_branches")
      .select("id, name, code, is_active, inactivity_threshold_weeks").in("id", ids).order("id").range(from, to)) : [];
    const branches: AnalyticsBranch[] = rows.map((row) => ({ id: row.id, name: row.name, code: row.code,
      isActive: row.is_active, inactivityThresholdWeeks: row.inactivity_threshold_weeks }));
    return { admin, branches, branchIds: ids, actorId: access.user.id };
  } catch (error) {
    console.error("Analytics branch access failed", error);
    throw new Error("Unable to load reporting branch access. Please try again.");
  }
});

export async function getAnalyticsBranchOptions(): Promise<readonly AnalyticsBranch[]> {
  return (await getAnalyticsContext()).branches;
}

/** No module-specific permission gates: Reports permission and scope are validated by the public entry points. */
const loadInactivityInputs = cache(async function loadInactivityInputs(admin: ReturnType<typeof createAdminClient>, branches: readonly AnalyticsBranch[], today: string): Promise<MemberInactivitySummary[]> {
  const ids = branches.filter((branch) => branch.isActive).map((branch) => branch.id);
  if (!ids.length) return [];
  const members = await allRows((from, to) => admin.from("members").select("id, church_branch_id, created_at")
    .in("church_branch_id", ids).eq("is_archived", false).order("id").range(from, to));
  const registrationDates = members.map((row) => manilaDateFromTimestamp(row.created_at))
    .filter((date): date is string => Boolean(date));
  const earliest = registrationDates.sort()[0];
  const [homeServices, attendance] = earliest ? await Promise.all([
    allRows((from, to) => admin.from("services").select("id, church_branch_id, service_date, status")
      .in("church_branch_id", ids).eq("status", "completed").gte("service_date", earliest).lte("service_date", today).order("id").range(from, to)),
    loadMonitoringParticipation(admin, members.map(member => member.id), earliest, today),
  ]) : [[], []];
  const services = [...homeServices, ...attendance.map(record => {
    const service = record.services as unknown as { church_branch_id: string; status: string; service_date: string };
    if (!service) throw new Error("Missing participation service context.");
    return { id: record.service_id, ...service };
  })];
  return calculateWeeklyInactivity({
    members: members.map((row) => ({ id: row.id, branchId: row.church_branch_id, registrationDate: manilaDateFromTimestamp(row.created_at) })),
    services: services.map((row) => ({ id: row.id, branchId: row.church_branch_id, serviceDate: row.service_date, status: row.status })),
    attendance: attendance.map((row) => ({ memberId: row.member_id, serviceId: row.service_id, status: row.attendance_status })),
    thresholds: new Map(branches.map((branch) => [branch.id, branch.inactivityThresholdWeeks])), today,
  });
});

export async function getAnalyticsOverview(request: AnalyticsRequest = {}): Promise<AnalyticsOverview> {
  const context = await getAnalyticsContext();
  const selectedBranch = await getPortalBranchId();
  if (selectedBranch && request.branchId && selectedBranch !== request.branchId) throw new Error("The current branch has changed. Refresh and try again.");
  request = {...request, branchId: selectedBranch ?? request.branchId};
  const asOfDate = analyticsToday(new Date());
  const range = resolveAnalyticsDateRange(request.range, asOfDate);
  const grouping = request.grouping ?? "week";
  validateAnalyticsGrouping(grouping);
  if (request.branchId !== undefined && !context.branchIds.includes(request.branchId)) throw new Error("The selected reporting branch is outside your access.");
  try {
    const { admin } = context;
    const branches = request.branchId ? context.branches.filter((branch) => branch.id === request.branchId) : context.branches;
    if (request.branchId && !branches.length) throw new Error("Reporting branch no longer exists.");
    if (!branches.length) return assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches, inactivity: [], range, grouping, asOfDate, inactiveMembers: 0 });
    const [{ data, error }, inactivity, memberTotal, inactiveTotal] = await Promise.all([
      admin.rpc("get_reports_analytics", { p_branch_ids: branches.map((branch) => branch.id), p_from: range.from, p_to: range.to, p_grouping: grouping, p_as_of: asOfDate }),
      loadInactivityInputs(admin, branches, asOfDate),
      admin.from("members").select("id", { count: "exact", head: true })
        .in("church_branch_id", branches.map(branch => branch.id))
        .lte("created_at", `${range.to}T23:59:59.999999+08:00`),
      admin.from("members").select("id", { count: "exact", head: true })
        .in("church_branch_id", branches.map(branch => branch.id)).eq("is_archived", false).eq("member_status", "inactive"),
    ]);
    if (error) throw error;
    if (memberTotal.error) throw memberTotal.error;
    if (inactiveTotal.error) throw inactiveTotal.error;
    if (typeof inactiveTotal.count !== "number" || !Number.isSafeInteger(inactiveTotal.count) || inactiveTotal.count < 0) throw new Error("Inactive membership total is unavailable.");
    if (typeof memberTotal.count !== "number" || !Number.isSafeInteger(memberTotal.count) || memberTotal.count < 0) throw new Error("Membership total is unavailable.");
    if (!data || data.version !== 1) throw new Error("Analytics aggregation migration is unavailable or incompatible.");
    return assembleAnalytics({ aggregates: data as AnalyticsAggregates, branches, inactivity, range, grouping, asOfDate, membersAtEndDate: memberTotal.count, inactiveMembers: inactiveTotal.count });
  } catch (error) {
    console.error("Analytics load failed", error);
    throw new Error("Unable to load reporting data. Verify the analytics migration is applied and try again.");
  }
}

export async function getMemberStatusHistory(request: AnalyticsRequest = {}): Promise<MemberStatusHistory> {
  const context = await getAnalyticsContext();
  const selected = await getPortalBranchId();
  if (selected && request.branchId && selected !== request.branchId) throw new Error("The current branch has changed. Refresh and try again.");
  const branchId = selected ?? request.branchId;
  if (branchId && !context.branchIds.includes(branchId)) throw new Error("The selected reporting branch is outside your access.");
  const ids = context.branches.filter(branch => !branchId || branch.id === branchId).map(branch => branch.id);
  const range = resolveAnalyticsDateRange(request.range, analyticsToday(new Date()));
  const grouping = request.grouping ?? "week";
  validateAnalyticsGrouping(grouping);
  const { data, error } = await context.admin.rpc("get_member_status_history", {
    p_actor_id: context.actorId, p_branch_ids: ids, p_from: range.from, p_to: range.to, p_grouping: grouping,
  });
  if (error || !data || typeof data.trackingStartedAt !== "string" || !Array.isArray(data.points)) throw new Error("Member status history could not be loaded.");
  return data as MemberStatusHistory;
}

/** Per-service database counts only: no attendee identities are loaded. */
export async function getMostAttendedService(request: AnalyticsRequest = {}): Promise<MostAttendedService | null> {
  const context = await getAnalyticsContext();
  const selected = await getPortalBranchId();
  if (selected && request.branchId && selected !== request.branchId) throw new Error("The current branch has changed. Refresh and try again.");
  const branchId = selected ?? request.branchId;
  if (branchId && !context.branchIds.includes(branchId)) throw new Error("The selected reporting branch is outside your access.");
  const ids = context.branches.filter(branch => !branchId || branch.id === branchId).map(branch => branch.id);
  if (!ids.length) return null;
  const range = resolveAnalyticsDateRange(request.range, analyticsToday(new Date()));
  const services = await allRows((from, to) => context.admin.from("services")
    .select("id,name,service_date,start_time,attendance_records(count)")
    .in("church_branch_id", ids).eq("status", "completed")
    .gte("service_date", range.from).lte("service_date", range.to)
    .eq("attendance_records.attendance_status", "present")
    .order("service_date", { ascending: false }).order("start_time", { ascending: false, nullsFirst: false }).order("id").range(from, to));
  let best: MostAttendedService | null = null;
  for (const service of services) {
    const attendees = service.attendance_records?.[0]?.count;
    if (typeof attendees !== "number" || !Number.isSafeInteger(attendees) || attendees < 0) throw new Error("Service attendance count is unavailable.");
    // Query order resolves ties by latest service, then ID, including across pages.
    if (!best || attendees > best.attendees) best = { id: service.id, name: service.name, date: service.service_date, attendees };
  }
  return best;
}
