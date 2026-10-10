import "server-only";

import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import {
  getUserBranchScope,
  type BranchScope,
} from "@/lib/branch-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountPermission =
  | "accounts.view"
  | "accounts.invite"
  | "accounts.update_display_name"
  | "accounts.manage_roles"
  | "accounts.manage_branch_access"
  | "accounts.archive"
  | "accounts.restore";

export type AccountAccess = PermissionContext & BranchScope;

export type AccountBranchOption = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export async function requireAccountsPermission(
  permission: AccountPermission,
): Promise<AccountAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}

export async function getAccessibleActiveAccountBranches(
  access: Pick<AccountAccess, "branchIds" | "isSystemAdmin">,
  admin: ReturnType<typeof createAdminClient>,
): Promise<AccountBranchOption[]> {
  if (!access.isSystemAdmin && access.branchIds.length === 0) {
    return [];
  }

  const baseQuery = admin
    .from("church_branches")
    .select("id, name, code, is_active")
    .eq("is_active", true);

  const result = access.isSystemAdmin
    ? await baseQuery.order("name")
    : await baseQuery
      .in("id", access.branchIds)
      .order("name");

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    isActive: branch.is_active,
  }));
}

export async function assertActiveAccountBranchIds(
  admin: ReturnType<typeof createAdminClient>,
  access: Pick<AccountAccess, "branchIds" | "isSystemAdmin">,
  branchIds: string[],
) {
  if (branchIds.length === 0) return;

  if (
    !access.isSystemAdmin &&
    branchIds.some((branchId) => !access.branchIds.includes(branchId))
  ) {
    throw new Error(
      "You can only use church branches assigned to your account.",
    );
  }

  const { data, error } = await admin
    .from("church_branches")
    .select("id, is_active")
    .in("id", branchIds);

  if (error) {
    throw new Error(error.message);
  }

  const activeBranchIds = new Set(
    (data ?? [])
      .filter((branch) => branch.is_active)
      .map((branch) => branch.id),
  );

  if (branchIds.some((branchId) => !activeBranchIds.has(branchId))) {
    throw new Error(
      "One or more selected branches do not exist or are inactive.",
    );
  }
}

type SystemAdminSafetyAction = "archive" | "remove";

/**
 * Keep the final-active-system-admin safeguard in one place for all account
 * mutations. The system_admin key is intentionally special here because it
 * represents a protected system role, not an operational permission bypass.
 */
export async function assertSystemAdminChangeSafe(
  admin: ReturnType<typeof createAdminClient>,
  targetUserId: string,
  currentUserId: string,
  action: SystemAdminSafetyAction,
) {
  if (action === "remove" && targetUserId === currentUserId) {
    throw new Error(
      "You cannot remove your own system administrator access from this page.",
    );
  }

  const { data: systemAdminLinks, error: roleError } = await admin
    .from("user_roles")
    .select(`
      user_id,
      roles!inner (
        key,
        is_active
      )
    `)
    .eq("roles.key", "system_admin")
    .eq("roles.is_active", true);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const userIds = Array.from(
    new Set(
      (systemAdminLinks ?? [])
        .map((link) => link.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );

  if (!userIds.includes(targetUserId)) {
    return;
  }

  let activeSystemAdministratorCount = 0;

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, archived_at")
      .in("id", userIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const archivedAtByUserId = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.archived_at,
      ]),
    );

    // Missing profiles are treated as active so the safeguard fails closed.
    activeSystemAdministratorCount = userIds.filter(
      (userId) => !archivedAtByUserId.get(userId),
    ).length;
  }

  if (activeSystemAdministratorCount > 1) return;

  if (action === "archive" && targetUserId === currentUserId) {
    throw new Error(
      "You cannot archive your own account because it is the last active system administrator.",
    );
  }

  throw new Error(
    action === "archive"
      ? "This account cannot be archived because it is the last active system administrator."
      : "The last active system administrator cannot be removed.",
  );
}
