"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertActiveAccountBranchIds,
  assertSystemAdminChangeSafe,
  requireAccountsPermission,
} from "../access";

type RoleRelation = {
  id: string;
  key: string;
  display_name: string | null;
  is_staff: boolean;
  is_system: boolean;
  is_active: boolean;
};

type RoleLinkRow = {
  role_id?: string | null;
  roles: RoleRelation | RoleRelation[] | null;
};

type RoleAssignment = {
  id: string;
  key: string;
  displayName: string;
  isStaff: boolean;
  isSystem: boolean;
  isActive: boolean;
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
  key: string;
  display_name: string | null;
  is_staff: boolean;
  is_system: boolean;
  is_active: boolean;
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
        key: role.key,
        displayName: role.display_name?.trim() || role.key,
        isStaff: role.is_staff,
        isSystem: role.is_system,
        isActive: role.is_active,
      }))
      .filter(
        (role): role is RoleAssignment =>
          Boolean(role.id && role.key),
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
) {
  // The administrator's submitted name is the intended account-level label
  // for both new invitations and existing-account promotions. Upsert also
  // handles a profile trigger creating the row before this write runs.
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: displayName,
      },
      { onConflict: "id" },
    );

  if (error) {
    throw new Error(error.message);
  }

  await verifyProvisionProfileDisplayName(
    admin,
    userId,
    displayName,
  );
}

async function verifyProvisionProfileDisplayName(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  expectedDisplayName: string,
) {
  const profile = await loadProvisionProfile(admin, userId);

  if (!profile || profile.display_name !== expectedDisplayName) {
    throw new Error(
      "The staff account profile was created, but its display name could not be verified.",
    );
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
        key,
        display_name,
        is_staff,
        is_system,
        is_active
      )
    `)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return parseRoleAssignments((data ?? []) as RoleLinkRow[]);
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
          key,
          display_name,
          is_staff,
          is_system,
          is_active
        )
      `)
      .eq("user_id", userId),
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
    role.isStaff && role.isActive,
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

function revalidateStaffAccess(userId: string) {
  revalidatePath(`/portal/accounts/staff/${userId}`);
  revalidatePath("/portal/accounts/staff");
  revalidatePath("/portal/administration/staff-branch-access");
}

export async function updateStaffDisplayName(
  userId: string,
  displayName: string,
) {
  await requireAccountsPermission(
    "accounts.update_display_name",
  );

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("A staff account is required.");
  }

  if (typeof displayName !== "string") {
    throw new Error("Display name is required.");
  }

  const trimmedDisplayName = displayName.trim();

  if (!trimmedDisplayName) {
    throw new Error("Display name is required.");
  }

  if (trimmedDisplayName.length > 200) {
    throw new Error("Display name must be 200 characters or fewer.");
  }

  const admin = createAdminClient();
  await loadStaffAccount(admin, userId);
  await loadStaffProfile(admin, userId);

  const { error } = await admin
    .from("profiles")
    .update({ display_name: trimmedDisplayName })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await verifyProvisionProfileDisplayName(
    admin,
    userId,
    trimmedDisplayName,
  );

  revalidateStaffAccess(userId);

  return { success: true };
}

export async function archiveStaffAccount(userId: string) {
  const { user: currentUser } = await requireAccountsPermission(
    "accounts.archive",
  );
  const admin = createAdminClient();
  const target = await loadStaffAccount(admin, userId);
  const profile = await loadStaffProfile(admin, userId);

  assertAuthAccountIsNotDeleted(target);

  if (profile.archived_at) {
    throw new Error("This staff account is already archived.");
  }

  const targetIsSystemAdmin = target.staffRoleAssignments.some(
    (role) => role.key === "system_admin",
  );

  if (targetIsSystemAdmin) {
    await assertSystemAdminChangeSafe(
      admin,
      userId,
      currentUser.id,
      "archive",
    );
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
  await requireAccountsPermission("accounts.restore");

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
  const { user: currentUser } = await requireAccountsPermission(
    "accounts.manage_roles",
  );

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
    .select(
      "id, key, display_name, is_staff, is_system, is_active",
    )
    .eq("is_staff", true)
    .eq("is_active", true)
    .order("display_name");

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const manageableRoles = (
    (roleRows ?? []) as RoleRecord[]
  ).filter((role) => role.is_staff && role.is_active);

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
    (role) => role.key === "system_admin",
  );
  const nextHasSystemAdmin = requestedRoles.some(
    (role) => role.key === "system_admin",
  );

  if (currentHasSystemAdmin && !nextHasSystemAdmin) {
    await assertSystemAdminChangeSafe(
      admin,
      userId,
      currentUser.id,
      "remove",
    );
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
  const access = await requireAccountsPermission(
    "accounts.manage_branch_access",
  );

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
      (role) => role.key === "system_admin",
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

  if (!access.isSystemAdmin) {
    const inaccessibleNewBranches = branchIds.filter(
      (branchId) =>
        !access.branchIds.includes(branchId) &&
        !currentBranchIds.has(branchId),
    );
    const inaccessibleRemovedBranches = Array.from(
      currentBranchIds,
    ).filter(
      (branchId) =>
        !access.branchIds.includes(branchId) &&
        !branchIds.includes(branchId),
    );

    if (
      inaccessibleNewBranches.length > 0 ||
      inaccessibleRemovedBranches.length > 0
    ) {
      throw new Error(
        "You can only add or remove branch assignments within branches assigned to your account.",
      );
    }
  }

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

  const { error: deleteError } = await admin
    .from("user_branch_access")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (branchIds.length > 0) {
    const { error: insertError } = await admin
      .from("user_branch_access")
      .insert(
        branchIds.map((branchId) => ({
          user_id: userId,
          church_branch_id: branchId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidateStaffAccess(userId);

  return { success: true };
}

export async function createStaffAccount(
  formData: FormData,
): Promise<StaffAccountProvisionResult> {
  const access = await requireAccountsPermission("accounts.invite");

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
      .select(
        "id, key, display_name, is_staff, is_system, is_active",
      )
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

      return !role || !role.is_staff || !role.is_active;
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

    const finalRoleKeys = new Set([
      ...currentRoleAssignments.map((role) => role.key),
      ...selectedRoles.map((role) => role.key),
    ]);
    const hasSystemAdmin = finalRoleKeys.has("system_admin");

    if (!hasSystemAdmin && requestedBranchIds.length === 0) {
      throw new Error(
        "Select at least one active branch for non-system-admin staff.",
      );
    }

    await assertActiveAccountBranchIds(
      admin,
      access,
      requestedBranchIds,
    );

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
