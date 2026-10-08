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

type StaffProfile = {
  id: string;
  archived_at: string | null;
};

type StaffAccountContext = {
  roleAssignments: RoleAssignment[];
  staffRoleAssignments: RoleAssignment[];
  authUser: {
    id: string;
    deleted_at: string | null;
  };
};

type RoleRecord = {
  id: string;
  name: string;
};

type AuthUserRecord = {
  id: string;
  email?: string | null;
  banned_until?: string | null;
  deleted_at?: string | null;
};

type ProvisionProfile = {
  id: string;
  display_name: string | null;
  archived_at: string | null;
};

export type StaffAccountProvisionResult = {
  success: boolean;
  userId?: string;
  created?: boolean;
  error?: string;
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

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<AuthUserRecord | null> {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        banned_until: existingUser.banned_until ?? null,
        deleted_at: existingUser.deleted_at ?? null,
      };
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function loadProvisionProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ProvisionProfile | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, archived_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProvisionProfile | null;
}

async function ensureProvisionProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  displayName: string,
  overwriteExisting: boolean,
) {
  const profile = await loadProvisionProfile(admin, userId);

  if (profile) {
    if (overwriteExisting || !profile.display_name?.trim()) {
      const { error } = await admin
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
      }
    }

    return;
  }

  const { error } = await admin.from("profiles").insert({
    id: userId,
    display_name: displayName,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function loadAllRoleAssignments(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<RoleAssignment[]> {
  const { data, error } = await admin
    .from("user_roles")
    .select(`
      role_id,
      roles!inner (
        id,
        name
      )
    `)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return parseRoleAssignments((data ?? []) as RoleLinkRow[]);
}

async function validateActiveBranchIds(
  admin: ReturnType<typeof createAdminClient>,
  branchIds: string[],
) {
  if (branchIds.length === 0) return;

  const { data, error } = await admin
    .from("church_branches")
    .select("id, is_active")
    .in("id", branchIds);

  if (error) {
    throw new Error(error.message);
  }

  const branchMap = new Map(
    (data ?? []).map((branch) => [branch.id, branch]),
  );

  const invalidBranchIds = branchIds.filter((branchId) => {
    const branch = branchMap.get(branchId);

    return !branch || !branch.is_active;
  });

  if (invalidBranchIds.length > 0) {
    throw new Error(
      "One or more selected branches do not exist or are inactive.",
    );
  }
}

function isCurrentlyBanned(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false;

  const bannedUntilTime = Date.parse(bannedUntil);

  return (
    !Number.isFinite(bannedUntilTime) ||
    bannedUntilTime > Date.now()
  );
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    throw new Error(`A valid ${name.replaceAll("_", " ")} is required.`);
  }

  return value.trim();
}

function getFormStringList(formData: FormData, name: string) {
  const values = formData.getAll(name);

  if (
    values.some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  ) {
    throw new Error(`Invalid ${name.replaceAll("_", " ")} selection.`);
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()),
    ),
  );
}

function getProvisionError(
  error: unknown,
  newlyInvited: boolean,
) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Staff account provisioning could not be completed.";

  if (!newlyInvited) return message;

  return `The invitation was created, but staff access could not be fully provisioned: ${message} You can retry this email without creating another Auth account.`;
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
    authUser: {
      id: authData.user.id,
      deleted_at: authData.user.deleted_at ?? null,
    },
  };
}

async function loadStaffProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<StaffProfile> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, archived_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const profile = data as StaffProfile | null;

  if (!profile) {
    throw new Error(
      "The staff account profile could not be found.",
    );
  }

  return profile;
}

function assertStaffAccountIsActive(profile: StaffProfile) {
  if (profile.archived_at) {
    throw new Error(
      "Archived staff accounts are read-only. Restore the account before changing roles or branch access.",
    );
  }
}

function assertAuthAccountIsNotDeleted(
  target: StaffAccountContext,
) {
  if (target.authUser.deleted_at) {
    throw new Error(
      "This Auth account has been deleted and cannot be archived or restored.",
    );
  }
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

export async function archiveStaffAccount(userId: string) {
  const { user: currentUser } = await requirePortalTab("accounts");
  const admin = createAdminClient();
  const target = await loadStaffAccount(admin, userId);
  const profile = await loadStaffProfile(admin, userId);

  assertAuthAccountIsNotDeleted(target);

  if (profile.archived_at) {
    throw new Error("This staff account is already archived.");
  }

  const targetIsSystemAdmin = target.staffRoleAssignments.some(
    (role) => role.name === "system_admin",
  );

  if (targetIsSystemAdmin) {
    const activeSystemAdministratorCount =
      await countActiveSystemAdministrators(admin);

    if (activeSystemAdministratorCount <= 1) {
      if (currentUser.id === userId) {
        throw new Error(
          "You cannot archive your own account because it is the last active system administrator.",
        );
      }

      throw new Error(
        "This account cannot be archived because it is the last active system administrator.",
      );
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateStaffAccess(userId);

  return { success: true };
}

export async function restoreStaffAccount(userId: string) {
  await requirePortalTab("accounts");

  const admin = createAdminClient();
  const target = await loadStaffAccount(admin, userId);
  const profile = await loadStaffProfile(admin, userId);

  assertAuthAccountIsNotDeleted(target);

  if (!profile.archived_at) {
    throw new Error("This staff account is already active.");
  }

  const { error } = await admin
    .from("profiles")
    .update({ archived_at: null })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateStaffAccess(userId);

  return { success: true };
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
  const profile = await loadStaffProfile(admin, userId);

  assertStaffAccountIsActive(profile);

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
  const profile = await loadStaffProfile(admin, userId);

  assertStaffAccountIsActive(profile);

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

export async function createStaffAccount(
  formData: FormData,
): Promise<StaffAccountProvisionResult> {
  const { roles: currentUserRoles } =
    await requirePortalTab("accounts");

  if (!currentUserRoles.includes("system_admin")) {
    return {
      success: false,
      error: "Only system administrators can create staff accounts.",
    };
  }

  let userId: string | null = null;
  let newlyInvited = false;
  let provisioningStarted = false;

  try {
    const displayName = getFormString(formData, "display_name");
    const email = getFormString(formData, "email").toLowerCase();
    const requestedRoleIds = getFormStringList(
      formData,
      "role_ids",
    );
    const requestedBranchIds = getFormStringList(
      formData,
      "branch_ids",
    );

    if (!displayName) {
      throw new Error("Display name is required.");
    }

    if (displayName.length > 200) {
      throw new Error("Display name must be 200 characters or fewer.");
    }

    if (
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("Enter a valid email address.");
    }

    if (requestedRoleIds.length === 0) {
      throw new Error("Select at least one staff role.");
    }

    const admin = createAdminClient();

    const { data: roleRows, error: rolesError } = await admin
      .from("roles")
      .select("id, name")
      .in("id", requestedRoleIds);

    if (rolesError) {
      throw new Error(rolesError.message);
    }

    const roleRecords = (roleRows ?? []) as RoleRecord[];
    const roleById = new Map(
      roleRecords.map((role) => [role.id, role]),
    );
    const invalidRoleIds = requestedRoleIds.filter((roleId) => {
      const role = roleById.get(roleId);

      return !role || !isStaffRole(role.name);
    });

    if (invalidRoleIds.length > 0) {
      throw new Error(
        "One or more selected roles are invalid or are not staff roles.",
      );
    }

    const selectedRoles = requestedRoleIds.map(
      (roleId) => roleById.get(roleId)!,
    );

    const existingUser = await findAuthUserByEmail(admin, email);
    let currentRoleAssignments: RoleAssignment[] = [];

    if (existingUser) {
      userId = existingUser.id;

      if (existingUser.deleted_at) {
        throw new Error(
          "This Auth account has been deleted and cannot be granted staff access.",
        );
      }

      if (isCurrentlyBanned(existingUser.banned_until)) {
        throw new Error(
          "This Auth account is currently banned and cannot be granted staff access.",
        );
      }

      const profile = await loadProvisionProfile(admin, userId);

      if (profile?.archived_at) {
        throw new Error(
          "This account is archived. Restore it before granting staff access.",
        );
      }

      currentRoleAssignments = await loadAllRoleAssignments(
        admin,
        userId,
      );
    }

    const finalRoleNames = new Set([
      ...currentRoleAssignments.map((role) => role.name),
      ...selectedRoles.map((role) => role.name),
    ]);
    const hasSystemAdmin = finalRoleNames.has("system_admin");

    if (!hasSystemAdmin && requestedBranchIds.length === 0) {
      throw new Error(
        "Select at least one active branch for non-system-admin staff.",
      );
    }

    await validateActiveBranchIds(admin, requestedBranchIds);

    if (!existingUser) {
      const { data, error } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            display_name: displayName,
          },
        });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error(
          "The invitation did not return a usable Auth account.",
        );
      }

      userId = data.user.id;
      newlyInvited = true;
    }

    if (!userId) {
      throw new Error("The staff account could not be identified.");
    }

    provisioningStarted = true;

    await ensureProvisionProfile(
      admin,
      userId,
      displayName,
      newlyInvited,
    );

    const { error: roleAssignmentError } = await admin
      .from("user_roles")
      .upsert(
        selectedRoles.map((role) => ({
          user_id: userId,
          role_id: role.id,
        })),
        {
          onConflict: "user_id,role_id",
          ignoreDuplicates: true,
        },
      );

    if (roleAssignmentError) {
      throw new Error(roleAssignmentError.message);
    }

    if (!hasSystemAdmin && requestedBranchIds.length > 0) {
      const { error: branchAssignmentError } = await admin
        .from("user_branch_access")
        .upsert(
          requestedBranchIds.map((branchId) => ({
            user_id: userId,
            church_branch_id: branchId,
          })),
          {
            onConflict: "user_id,church_branch_id",
            ignoreDuplicates: true,
          },
        );

      if (branchAssignmentError) {
        throw new Error(branchAssignmentError.message);
      }
    }

    revalidateStaffAccess(userId);

    return {
      success: true,
      userId,
      created: newlyInvited,
    };
  } catch (error) {
    if (userId && provisioningStarted) {
      revalidateStaffAccess(userId);
    }

    return {
      success: false,
      error: getProvisionError(error, newlyInvited),
    };
  }
}
