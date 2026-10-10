import { redirect } from "next/navigation";

import { getCurrentUser, getCurrentUserRoles } from "@/lib/auth";
import { canAccessTab } from "@/lib/portal-access";
import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ServicePermission =
  | "services.view"
  | "services.create"
  | "services.update";

/**
 * Legacy branch context used by Attendance, Contributions, and Baptisms
 * until those modules are migrated to permissions.
 */
export type ServiceAccess = Awaited<
  ReturnType<typeof requirePortalTab>
>;

export type ServiceBranchScope = {
  branchIds: string[];
  isSystemAdmin: boolean;
};

export type PermissionServiceAccess = PermissionContext &
  ServiceBranchScope;

export type ServiceBranchOption = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

async function getServiceBranchScope(userId: string) {
  const supabase = await createClient();

  const { data: roleLinks, error: roleError } = await supabase
    .from("user_roles")
    .select(`
      roles!inner (
        key,
        is_active
      )
    `)
    .eq("user_id", userId);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const isSystemAdmin = (roleLinks ?? []).some((link) => {
    const role = Array.isArray(link.roles)
      ? link.roles[0] ?? null
      : link.roles;

    return role?.is_active === true && role.key === "system_admin";
  });

  if (isSystemAdmin) {
    const { data: branches, error: branchError } = await supabase
      .from("church_branches")
      .select("id")
      .eq("is_active", true);

    if (branchError) {
      throw new Error(branchError.message);
    }

    return {
      branchIds: (branches ?? []).map((branch) => branch.id),
      isSystemAdmin: true,
    };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("user_branch_access")
    .select("church_branch_id")
    .eq("user_id", userId);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  return {
    branchIds: (assignments ?? []).map(
      (assignment) => assignment.church_branch_id,
    ),
    isSystemAdmin: false,
  };
}

/**
 * Legacy role-based access context retained for unmigrated modules that
 * reuse Services branch-loading helpers.
 */
export async function requireServicesAccess() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (roles.includes("system_admin")) {
    return requirePortalTab("accounts");
  }

  if (!canAccessTab(roles, "attendance")) {
    redirect("/access-denied");
  }

  return requirePortalTab("attendance");
}

export async function requireServicesPermission(
  permission: ServicePermission,
): Promise<PermissionServiceAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getServiceBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}

export async function getAccessibleActiveBranches(
  access: ServiceBranchScope,
  admin: ReturnType<typeof createAdminClient>,
): Promise<ServiceBranchOption[]> {
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

export async function assertActiveServiceBranch(
  admin: ReturnType<typeof createAdminClient>,
  access: ServiceBranchScope,
  branchId: string,
) {
  if (!branchId) {
    throw new Error("A church branch is required.");
  }

  if (
    !access.isSystemAdmin &&
    !access.branchIds.includes(branchId)
  ) {
    throw new Error(
      "You can only use church branches assigned to your account.",
    );
  }

  const { data, error } = await admin
    .from("church_branches")
    .select("id, name, code, is_active")
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "The selected church branch does not exist or is inactive.",
    );
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    isActive: data.is_active,
  } satisfies ServiceBranchOption;
}
