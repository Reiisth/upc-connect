import "server-only";
import { getUserBranchScope, type BranchScope } from "@/lib/branch-access";
import { requirePermission, type PermissionContext } from "@/lib/permissions-server";

export type FollowUpPermission = "follow_ups.view" | "follow_ups.create" | "follow_ups.update";
export type FollowUpAccess = PermissionContext & BranchScope;

export async function requireFollowUpsPermission(permission: FollowUpPermission): Promise<FollowUpAccess> {
  const access = await requirePermission(permission);
  return { ...access, ...await getUserBranchScope(access.user.id) };
}
