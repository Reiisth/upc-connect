import {
  getAccessibleActiveBranches,
  assertActiveServiceBranch,
} from "../services/access";
import {
  getUserBranchScope,
  type BranchScope,
} from "@/lib/branch-access";
import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import { createAdminClient } from "@/lib/supabase/admin";

export type WeddingPermission =
  | "weddings.view"
  | "weddings.create"
  | "weddings.update";

export type WeddingAccess = PermissionContext & BranchScope;

export async function requireWeddingsPermission(
  permission: WeddingPermission,
): Promise<WeddingAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}

export async function getAccessibleWeddingBranches(
  access: WeddingAccess,
  admin: ReturnType<typeof createAdminClient>,
) {
  return getAccessibleActiveBranches(access, admin);
}

export async function assertActiveWeddingBranch(
  admin: ReturnType<typeof createAdminClient>,
  access: WeddingAccess,
  branchId: string,
) {
  return assertActiveServiceBranch(admin, access, branchId);
}
