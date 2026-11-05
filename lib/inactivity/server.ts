import { loadPhysicalParticipation } from "@/lib/inactivity/participation";
import "server-only";

import { getUserBranchScope } from "@/lib/branch-access";
import { requirePermission } from "@/lib/permissions-server";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateWeeklyInactivity, manilaDate, manilaDateFromTimestamp } from "./calculate";
import type { InactivityBranch, InactivityMemberRow } from "./presentation";

type QueryPage<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

/** Explicit pagination prevents the API row cap from truncating history. */
async function allRows<T>(page: (from: number, to: number) => QueryPage<T>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

/**
 * Request-scoped server entry point. Never accept caller-supplied access claims.
 * Reload source records each call so attendance corrections are reflected.
 * Load all non-archived branch members regardless of stored member_status.
 * Missing/invalid created_at stays visible as unknown; first_attendance_date is
 * historical reference data and does not control monitoring eligibility.
 * This does not change or persist their lifecycle status.
 */
export async function getBranchMemberInactivity(branchId: string): Promise<InactivityMemberRow[]> {
  const access = await requirePermission("inactivity.view");
  const scope = await getUserBranchScope(access.user.id);
  if (!scope.branchIds.includes(branchId)) {
    throw new Error("You can only view inactivity for accessible active branches.");
  }

  const admin = createAdminClient();
  const { data: branch, error } = await admin.from("church_branches")
    .select("id, inactivity_threshold_weeks")
    .eq("id", branchId).eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!branch) throw new Error("The selected branch does not exist or is inactive.");
  const today = manilaDate(new Date());

  const members = await allRows((from, to) => admin.from("members")
    .select("id, first_name, middle_name, last_name, church_branch_id, created_at, member_status")
    .eq("church_branch_id", branchId).eq("is_archived", false)
    .order("id").range(from, to));
  const registrationDates = members.map((member) => manilaDateFromTimestamp(member.created_at))
    .filter((date): date is string => Boolean(date));
  const earliestRegistrationDate = registrationDates.sort()[0];
  const [homeServices, attendance] = earliestRegistrationDate ? await Promise.all([
    allRows((from, to) => admin.from("services")
      .select("id, church_branch_id, service_date, status")
      .eq("church_branch_id", branchId).eq("status", "completed")
      .gte("service_date", earliestRegistrationDate).lte("service_date", today).order("id").range(from, to)),
    loadPhysicalParticipation(admin, members.map(member => member.id), earliestRegistrationDate, today),
  ]) : [[], []];

  // Read only participation facts for already-authorized home members, not foreign rosters.
  const services = [...homeServices, ...attendance.flatMap(record => {
    const service = record.services as unknown as { church_branch_id: string; service_date: string; status: string } | null;
    if (!service) throw new Error("Missing participation service context.");
    return [{ id: record.service_id, ...service }];
  })];
  const summaries = calculateWeeklyInactivity({
    members: members.map((member) => ({
      id: member.id, branchId: member.church_branch_id,
      registrationDate: manilaDateFromTimestamp(member.created_at),
    })),
    services: services.map((service) => ({
      id: service.id, branchId: service.church_branch_id,
      serviceDate: service.service_date, status: service.status,
    })),
    attendance: attendance.map((record) => ({
      memberId: record.member_id, serviceId: record.service_id, status: record.attendance_status,
    })),
    thresholds: new Map([[branch.id, branch.inactivity_threshold_weeks]]),
    today,
  });
  const names = new Map(members.map((member) => [
    member.id,
    [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ").trim() || "Unnamed member",
  ]));
  const statuses = new Map(members.map((member) => [member.id, member.member_status]));
  return summaries.map((summary) => ({ ...summary, memberName: names.get(summary.memberId)!, memberStatus: statuses.get(summary.memberId)! }));
}

/** Branch choices and UI capabilities come from the current account, never roles in this module. */
export async function getInactivityBranchOptions(): Promise<{
  branches: InactivityBranch[];
  canManageSettings: boolean;
  canCreateFollowUps: boolean;
  canViewFollowUps: boolean;
  canViewMemberStatus: boolean;
  canUpdateMemberStatus: boolean;
}> {
  const access = await requirePermission("inactivity.view");
  const scope = await getUserBranchScope(access.user.id);
  const canManageSettings = hasPermission(access.permissions, "inactivity.manage_settings");
  const followUpCapabilities = {
    canCreateFollowUps: hasPermission(access.permissions, "follow_ups.create"),
    canViewFollowUps: hasPermission(access.permissions, "follow_ups.view"),
    canViewMemberStatus: hasPermission(access.permissions, "members.view"),
    canUpdateMemberStatus: hasPermission(access.permissions, "members.update"),
  };
  if (scope.branchIds.length === 0) return { branches: [], canManageSettings, ...followUpCapabilities };
  const admin = createAdminClient();
  const branches = await allRows((from, to) => admin.from("church_branches")
    .select("id, name, code, inactivity_threshold_weeks")
    .in("id", scope.branchIds).eq("is_active", true)
    .order("name").order("id").range(from, to));
  return {
    branches: branches.map((branch) => ({
      id: branch.id, name: branch.name, code: branch.code,
      inactivityThresholdWeeks: branch.inactivity_threshold_weeks,
    })),
    canManageSettings,
    ...followUpCapabilities,
  };
}
