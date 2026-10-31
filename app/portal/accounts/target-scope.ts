import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountAccess } from "./access";

type ActorScope = Pick<AccountAccess, "branchIds" | "isSystemAdmin">;
type Admin = ReturnType<typeof createAdminClient>;

export type AccountTargetScope = {
  userId: string;
  canViewMembers: boolean;
  canViewStaff: boolean;
  canChangeAccount: boolean;
};

// Complete relationship metadata is required for authorization. Do not let an
// API row cap turn a partially visible account into a fully manageable one.
async function rows<T>(query: { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }> }) {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error("Unable to verify account scope.");
    result.push(...data ?? []);
    if ((data?.length ?? 0) < 500) return result;
  }
}

function related<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getAccountTargetScopes(access: ActorScope, admin: Admin, targetUserId?: string) {
  let ids: string[];
  if (targetUserId) {
    ids = [targetUserId];
  } else if (access.isSystemAdmin) {
    ids = (await rows(admin.from("profiles").select("id").order("id"))).map((row) => row.id);
  } else {
    if (!access.branchIds.length) return new Map<string, AccountTargetScope>();
    const [links, assignments] = await Promise.all([
      rows(admin.from("account_members").select("id, user_id, members!inner(church_branch_id)")
        .eq("relationship", "member").in("members.church_branch_id", access.branchIds).order("id")),
      rows(admin.from("user_branch_access").select("user_id, church_branch_id")
        .in("church_branch_id", access.branchIds).order("user_id").order("church_branch_id")),
    ]);
    ids = [...new Set([...links, ...assignments].map((row) => row.user_id))];
  }

  const result = new Map<string, AccountTargetScope>();
  // Bound PostgREST IN lists while gathering every relationship for each target.
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const [links, assignments, roles] = await Promise.all([
      rows(admin.from("account_members").select("id, user_id, members(church_branch_id)")
        .eq("relationship", "member").in("user_id", batch).order("id")),
      rows(admin.from("user_branch_access").select("user_id, church_branch_id")
        .in("user_id", batch).order("user_id").order("church_branch_id")),
      rows(admin.from("user_roles").select("user_id, role_id, roles(key, is_staff, is_active)")
        .in("user_id", batch).order("user_id").order("role_id")),
    ]);
    for (const userId of batch) {
      const memberBranches = links.filter((row) => row.user_id === userId)
        .map((row) => related(row.members)?.church_branch_id ?? null);
      const staffBranches = assignments.filter((row) => row.user_id === userId).map((row) => row.church_branch_id);
      const roleMetadata = roles.filter((row) => row.user_id === userId).map((row) => related(row.roles));
      // Even an inactive system-admin assignment is protected from delegated
      // management. Inactive staff relationships still matter for safe writes.
      const protectedAdmin = roleMetadata.some((role) => role?.key === "system_admin");
      const hasStaff = roleMetadata.some((role) => role?.is_staff);
      const memberOverlap = memberBranches.some((id) => id !== null && access.branchIds.includes(id));
      const staffOverlap = hasStaff && staffBranches.some((id) => access.branchIds.includes(id));
      const allBranches = [...memberBranches, ...staffBranches];
      const fullyCovered = allBranches.length > 0 &&
        allBranches.every((id) => id !== null && access.branchIds.includes(id)) &&
        (!hasStaff || staffBranches.length > 0);
      result.set(userId, {
        userId,
        canViewMembers: access.isSystemAdmin || !protectedAdmin && memberOverlap,
        canViewStaff: access.isSystemAdmin || !protectedAdmin && staffOverlap,
        canChangeAccount: access.isSystemAdmin || !protectedAdmin && fullyCovered,
      });
    }
  }
  return result;
}

export async function requireAccountTarget(
  access: ActorScope,
  admin: Admin,
  targetUserId: string,
  operation: "members" | "staff" | "change" | "branches" = "change",
) {
  if (typeof targetUserId !== "string" || !targetUserId.trim()) redirect("/access-denied");
  const target = (await getAccountTargetScopes(access, admin, targetUserId)).get(targetUserId);
  const allowed = operation === "members" ? target?.canViewMembers
    : operation === "staff" || operation === "branches" ? target?.canViewStaff
    : target?.canChangeAccount;
  if (!allowed) redirect("/access-denied");
  return target!;
}

export function isGrantableStaffRole(access: ActorScope, role: { key: string; is_staff: boolean; is_active: boolean }) {
  return role.is_active && role.is_staff && role.key !== "member" &&
    (role.key !== "system_admin" || access.isSystemAdmin);
}
