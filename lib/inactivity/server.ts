import "server-only";

import { getUserBranchScope } from "@/lib/branch-access";
import { requirePermission } from "@/lib/permissions-server";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateWeeklyInactivity, manilaDate } from "./calculate";
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
 * Missing eligibility stays visible as unknown for future data cleanup.
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

  const [members, services, attendance] = await Promise.all([
    allRows((from, to) => admin.from("members")
      .select("id, first_name, middle_name, last_name, church_branch_id, first_attendance_date")
      .eq("church_branch_id", branchId).eq("is_archived", false)
      .order("id").range(from, to)),
    allRows((from, to) => admin.from("services")
      .select("id, church_branch_id, service_date, status")
      .eq("church_branch_id", branchId).eq("status", "completed")
      .lte("service_date", today).order("id").range(from, to)),
    allRows((from, to) => admin.from("attendance_records")
      .select("id, member_id, service_id, attendance_status, services!inner(church_branch_id, status, service_date)")
      .eq("services.church_branch_id", branchId).eq("services.status", "completed")
      .lte("services.service_date", today).in("attendance_status", ["present", "late"])
      .order("id").range(from, to)),
  ]);

  const summaries = calculateWeeklyInactivity({
    members: members.map((member) => ({
      id: member.id, branchId: member.church_branch_id,
      // No created_at/account-acceptance fallback: neither proves attendance eligibility.
      eligibilityDate: member.first_attendance_date,
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
  return summaries.map((summary) => ({ ...summary, memberName: names.get(summary.memberId)! }));
}

/** Branch choices and UI capabilities come from the current account, never roles in this module. */
export async function getInactivityBranchOptions(): Promise<{
  branches: InactivityBranch[];
  canManageSettings: boolean;
  canCreateFollowUps: boolean;
  canViewFollowUps: boolean;
}> {
  const access = await requirePermission("inactivity.view");
  const scope = await getUserBranchScope(access.user.id);
  const canManageSettings = hasPermission(access.permissions, "inactivity.manage_settings");
  const followUpCapabilities = {
    canCreateFollowUps: hasPermission(access.permissions, "follow_ups.create"),
    canViewFollowUps: hasPermission(access.permissions, "follow_ups.view"),
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
