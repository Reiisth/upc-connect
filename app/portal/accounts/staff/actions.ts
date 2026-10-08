"use server";

import { revalidatePath } from "next/cache";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { isStaffRole } from "@/lib/staff-roles";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  updateStaffBranchAccess as persistStaffBranchAccess,
} from "@/app/portal/administration/staff-branch-access/actions";

type RoleRelation = {
  id: string;
  name: string;
};

type RoleLinkRow = {
  role_id?: string | null;
  roles: RoleRelation | RoleRelation[] | null;
};

type RoleAssignment = {
  id: string;
  name: string;
};

type StaffAccountContext = {
  roleAssignments: RoleAssignment[];
  staffRoleAssignments: RoleAssignment[];
};

type RoleRecord = {
  id: string;
  name: string;
};

function parseRoleAssignments(
  roleLinks: RoleLinkRow[],
): RoleAssignment[] {
  return roleLinks.flatMap((link) => {
    if (!link.roles) return [];

    const roles = Array.isArray(link.roles)
      ? link.roles
      : [link.roles];

    return roles
      .map((role) => ({
        id: link.role_id ?? role.id,
        name: role.name,
      }))
      .filter(
        (role): role is RoleAssignment =>
          Boolean(role.id && role.name),
      );
  });
}

async function loadStaffAccount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<StaffAccountContext> {
  if (!userId) {
    throw new Error("A staff account is required.");
  }

  const [
    { data: authData, error: authError },
    { data: roleLinks, error: roleError },
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),

    admin
      .from("user_roles")
      .select(`
        role_id,
        roles!inner (
          id,
          name
        )
      `)
      .eq("user_id", userId)
      .neq("roles.name", "member"),
  ]);

  if (authError || !authData.user) {
    throw new Error("The requested account does not exist.");
  }

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roleAssignments = parseRoleAssignments(
    (roleLinks ?? []) as RoleLinkRow[],
  );
  const staffRoleAssignments = roleAssignments.filter((role) =>
    isStaffRole(role.name),
  );

  if (staffRoleAssignments.length === 0) {
    throw new Error("The requested account is not a staff account.");
  }

  return {
    roleAssignments,
    staffRoleAssignments,
  };
}

async function countActiveSystemAdministrators(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: systemAdminLinks, error: roleError } = await admin
    .from("user_roles")
    .select(`
      user_id,
      roles!inner (
        name
      )
    `)
    .eq("roles.name", "system_admin");

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

  if (userIds.length === 0) return 0;

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

  // Missing profile rows are treated as active so the safeguard fails closed.
  return userIds.filter(
    (userId) => !archivedAtByUserId.get(userId),
  ).length;
}

function revalidateStaffAccess(userId: string) {
  revalidatePath(`/portal/accounts/staff/${userId}`);
  revalidatePath("/portal/accounts/staff");
  revalidatePath("/portal/administration/staff-branch-access");
}

export async function updateStaffRoles(
  userId: string,
  requestedRoleIds: string[],
) {
  const { user: currentUser } = await requirePortalTab("accounts");

  if (
    !Array.isArray(requestedRoleIds) ||
    requestedRoleIds.some(
      (roleId) => typeof roleId !== "string" || !roleId,
    )
  ) {
    throw new Error("Invalid staff role selection.");
  }

  const admin = createAdminClient();
  const target = await loadStaffAccount(admin, userId);
  const requestedIds = Array.from(new Set(requestedRoleIds));

  const { data: roleRows, error: rolesError } = await admin
    .from("roles")
    .select("id, name")
    .neq("name", "member")
    .order("name");

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const manageableRoles = (
    (roleRows ?? []) as RoleRecord[]
  ).filter((role) => isStaffRole(role.name));

  const roleById = new Map(
    manageableRoles.map((role) => [role.id, role]),
  );
  const invalidRoleIds = requestedIds.filter(
    (roleId) => !roleById.has(roleId),
  );

  if (invalidRoleIds.length > 0) {
    throw new Error(
      "One or more selected roles are invalid or are not staff roles.",
    );
  }

  const requestedRoles = requestedIds.map(
    (roleId) => roleById.get(roleId)!,
  );
  const currentStaffRoleIds = new Set(
    target.staffRoleAssignments.map((role) => role.id),
  );
  const currentHasSystemAdmin = target.staffRoleAssignments.some(
    (role) => role.name === "system_admin",
  );
  const nextHasSystemAdmin = requestedRoles.some(
    (role) => role.name === "system_admin",
  );

  if (currentHasSystemAdmin && !nextHasSystemAdmin) {
    if (currentUser.id === userId) {
      throw new Error(
        "You cannot remove your own system administrator access from this page.",
      );
    }

    const activeSystemAdministratorCount =
      await countActiveSystemAdministrators(admin);

    if (activeSystemAdministratorCount <= 1) {
      throw new Error(
        "The last active system administrator cannot be removed.",
      );
    }
  }

  const requestedRoleIdSet = new Set(requestedIds);
  const roleIdsToAdd = requestedIds.filter(
    (roleId) => !currentStaffRoleIds.has(roleId),
  );
  const roleIdsToRemove = Array.from(currentStaffRoleIds).filter(
    (roleId) => !requestedRoleIdSet.has(roleId),
  );

  if (roleIdsToAdd.length > 0) {
    const { error: insertError } = await admin
      .from("user_roles")
      .insert(
        roleIdsToAdd.map((roleId) => ({
          user_id: userId,
          role_id: roleId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  if (roleIdsToRemove.length > 0) {
    const { error: deleteError } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role_id", roleIdsToRemove);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  revalidateStaffAccess(userId);

  return { success: true };
}

export async function updateStaffBranchAccessFromAccount(
  userId: string,
  requestedBranchIds: string[],
) {
  await requirePortalTab("accounts");

  if (
    !Array.isArray(requestedBranchIds) ||
    requestedBranchIds.some(
      (branchId) => typeof branchId !== "string" || !branchId,
    )
  ) {
    throw new Error("Invalid branch selection.");
  }

  const admin = createAdminClient();
  const target = await loadStaffAccount(admin, userId);

  if (
    target.staffRoleAssignments.some(
      (role) => role.name === "system_admin",
    )
  ) {
    throw new Error(
      "System administrators automatically have access to all active branches.",
    );
  }

  const branchIds = Array.from(new Set(requestedBranchIds));
  const [
    { data: currentAssignments, error: assignmentsError },
    { data: branchRows, error: branchesError },
  ] = await Promise.all([
    admin
      .from("user_branch_access")
      .select("church_branch_id")
      .eq("user_id", userId),

    admin
      .from("church_branches")
      .select("id, is_active")
      .order("id"),
  ]);

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  const currentBranchIds = new Set(
    (currentAssignments ?? []).map(
      (assignment) => assignment.church_branch_id,
    ),
  );
  const branchMap = new Map(
    (branchRows ?? []).map((branch) => [branch.id, branch]),
  );
  const invalidBranchIds = branchIds.filter((branchId) => {
    const branch = branchMap.get(branchId);

    return (
      !branch ||
      (!branch.is_active && !currentBranchIds.has(branchId))
    );
  });

  if (invalidBranchIds.length > 0) {
    throw new Error(
      "One or more selected branches do not exist or are inactive.",
    );
  }

  // Reuse the existing branch-access persistence path after validating the
  // account and branch selection under the accounts RBAC boundary.
  await persistStaffBranchAccess(userId, branchIds);

  revalidateStaffAccess(userId);

  return { success: true };
}
