import { getUserBranchScope, type BranchScope } from "@/lib/branch-access";
import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";

export type MemberPermission =
  | "members.view"
  | "members.create"
  | "members.update"
  | "members.archive"
  | "members.link_account";

export type MemberAccess = PermissionContext & BranchScope;

export async function requireMembersPermission(
  permission: MemberPermission,
): Promise<MemberAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}
