import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import {
  getUserBranchScope,
  type BranchScope,
} from "@/lib/branch-access";

export type ContributionPermission =
  | "contributions.view"
  | "contributions.create"
  | "contributions.update";

export type ContributionAccess = PermissionContext & BranchScope;

/**
 * Require a Contributions permission and resolve branch scope independently.
 * Permissions decide what the user may do; branch scope decides where they
 * may do it.
 */
export async function requireContributionsPermission(
  permission: ContributionPermission,
): Promise<ContributionAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}
