"use server";

import { revalidatePath } from "next/cache";

import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions-server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { RoleMetadataInput } from "./types";

const PROTECTED_ROLE_KEYS = new Set([
  "system_admin",
  "member",
  "pastor",
  "accounting_officer",
  "evangelism_officer",
  "spiritual_ministry_officer",
  "usher",
]);

const MEMBER_PROTECTED_PERMISSION_KEYS = new Set([
  "profile.view",
  "profile.update",
]);

type RoleMutationRecord = {
  id: string;
  key: string;
  name: string | null;
  display_name: string | null;
  description: string | null;
  is_system: boolean;
  is_staff: boolean;
  is_active: boolean;
};

type PermissionMutationRecord = {
  id: string;
  key: string;
  is_active: boolean;
};

function getString(
  formData: FormData,
  name: string,
): string {
  const value = formData.get(name);

  if (typeof value !== "string") {
    throw new Error(`A valid ${name.replaceAll("_", " ")} is required.`);
  }

  return value.trim();
}

function getOptionalString(
  formData: FormData,
  name: string,
): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getStringList(
  formData: FormData,
  name: string,
): string[] {
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

function parseBoolean(
  formData: FormData,
  name: string,
): boolean {
  const value = formData.get(name);

  return value === "true" || value === "on";
}

function normalizeRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function validateDisplayName(displayName: string): string {
  if (!displayName) {
    throw new Error("Role display name is required.");
  }

  if (displayName.length > 120) {
    throw new Error("Role display name must be 120 characters or fewer.");
  }

  return displayName;
}

function validateDescription(description: string): string {
  if (description.length > 1000) {
    throw new Error("Role description must be 1000 characters or fewer.");
  }

  return description;
}

function validateNewRoleKey(value: string): string {
  const key = normalizeRoleKey(value);

  if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error(
      "Role key must start with a letter and contain only lowercase letters, numbers, and underscores.",
    );
  }

  if (key.length > 80) {
    throw new Error("Role key must be 80 characters or fewer.");
  }

  if (PROTECTED_ROLE_KEYS.has(key)) {
    throw new Error("That role key is reserved for a built-in role.");
  }

  return key;
}

async function loadRole(
  admin: ReturnType<typeof createAdminClient>,
  roleId: string,
): Promise<RoleMutationRecord> {
  if (!roleId || typeof roleId !== "string") {
    throw new Error("A role is required.");
  }

  const { data, error } = await admin
    .from("roles")
    .select(
      "id, key, name, display_name, description, is_system, is_staff, is_active",
    )
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("The requested role does not exist.");
  }

  return data as RoleMutationRecord;
}

async function validatePermissionIds(
  admin: ReturnType<typeof createAdminClient>,
  permissionIds: string[],
  currentPermissionIds: Set<string> = new Set(),
  preserveInactiveCurrent = false,
): Promise<PermissionMutationRecord[]> {
  if (permissionIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("permissions")
    .select("id, key, is_active")
    .in("id", permissionIds);

  if (error) {
    throw new Error(error.message);
  }

  const byId = new Map(
    ((data ?? []) as PermissionMutationRecord[]).map((permission) => [
      permission.id,
      permission,
    ]),
  );

  for (const permissionId of permissionIds) {
    const permission = byId.get(permissionId);

    if (!permission) {
      throw new Error("One or more selected permissions do not exist.");
    }

    if (
      !permission.is_active &&
      !(preserveInactiveCurrent && currentPermissionIds.has(permissionId))
    ) {
      throw new Error(
        "One or more selected permissions are inactive and cannot be assigned.",
      );
    }
  }

  return permissionIds.map((permissionId) => byId.get(permissionId)!);
}

async function getRolePermissionIds(
  admin: ReturnType<typeof createAdminClient>,
  roleId: string,
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data ?? [])
      .map((link) => link.permission_id)
      .filter((permissionId): permissionId is string => Boolean(permissionId)),
  );
}

function revalidateRolePaths(roleId?: string) {
  revalidatePath("/portal/administration");
  revalidatePath("/portal/administration/roles");

  if (roleId) {
    revalidatePath(`/portal/administration/roles/${roleId}`);
  }
}

export async function createCustomRole(formData: FormData) {
  const access = await requirePermission("roles.create");

  const displayName = validateDisplayName(
    getString(formData, "display_name"),
  );
  const key = validateNewRoleKey(getString(formData, "key"));
  const description = validateDescription(
    getOptionalString(formData, "description"),
  );
  const isStaff = parseBoolean(formData, "is_staff");
  const requestedPermissionIds = getStringList(
    formData,
    "permission_ids",
  );
  const canManagePermissions = hasPermission(
    access.permissions,
    "roles.manage_permissions",
  );

  if (!canManagePermissions && requestedPermissionIds.length > 0) {
    throw new Error(
      "You need roles.manage_permissions to assign permissions during role creation.",
    );
  }

  const admin = createAdminClient();
  let roleId: string | null = null;

  try {
    const { data, error } = await admin
      .from("roles")
      .insert({
        key,
        // Keep the legacy role-name column aligned with the immutable key.
        name: key,
        display_name: displayName,
        description: description || null,
        is_system: false,
        is_staff: isStaff,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("That role key is already in use.");
      }

      throw new Error(error.message);
    }

    roleId = data.id;

    if (canManagePermissions && requestedPermissionIds.length > 0) {
      await validatePermissionIds(admin, requestedPermissionIds);

      const { error: permissionError } = await admin
        .from("role_permissions")
        .insert(
          requestedPermissionIds.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
          })),
        );

      if (permissionError) {
        throw new Error(permissionError.message);
      }
    }
  } catch (error) {
    if (roleId) {
      const { error: cleanupError } = await admin
        .from("roles")
        .delete()
        .eq("id", roleId)
        .eq("is_system", false);

      if (cleanupError) {
        console.error(
          "Role creation failed and cleanup also failed.",
          cleanupError,
        );
      }
    }

    throw error;
  }

  revalidateRolePaths(roleId ?? undefined);

  return {
    success: true,
    roleId,
  };
}

export async function updateRoleMetadata(
  roleId: string,
  input: RoleMetadataInput,
) {
  await requirePermission("roles.update");

  if (
    !input ||
    typeof input !== "object" ||
    typeof input.displayName !== "string" ||
    typeof input.description !== "string" ||
    typeof input.isStaff !== "boolean"
  ) {
    throw new Error("Invalid role details.");
  }

  const displayName = validateDisplayName(input.displayName.trim());
  const description = validateDescription(input.description.trim());
  const admin = createAdminClient();
  const role = await loadRole(admin, roleId);

  const payload: Record<string, unknown> = {
    display_name: displayName,
    description: description || null,
    updated_at: new Date().toISOString(),
  };

  if (!role.is_system) {
    payload.is_staff = input.isStaff === true;
  }

  if (role.key === "member" && input.isStaff === true) {
    throw new Error("The member role cannot be converted into a staff role.");
  }

  const { error } = await admin
    .from("roles")
    .update(payload)
    .eq("id", role.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateRolePaths(role.id);

  return { success: true };
}

export async function updateRolePermissions(
  roleId: string,
  requestedPermissionIds: string[],
) {
  await requirePermission("roles.manage_permissions");

  if (
    !Array.isArray(requestedPermissionIds) ||
    requestedPermissionIds.some(
      (permissionId) =>
        typeof permissionId !== "string" || !permissionId.trim(),
    )
  ) {
    throw new Error("Invalid permission selection.");
  }

  const permissionIds = Array.from(
    new Set(requestedPermissionIds.map((permissionId) => permissionId.trim())),
  );
  const admin = createAdminClient();
  const role = await loadRole(admin, roleId);
  const currentPermissionIds = await getRolePermissionIds(admin, role.id);

  await validatePermissionIds(
    admin,
    permissionIds,
    currentPermissionIds,
    role.key === "system_admin",
  );

  const desiredPermissionIds = new Set(permissionIds);

  if (role.key === "system_admin") {
    for (const currentPermissionId of currentPermissionIds) {
      if (!desiredPermissionIds.has(currentPermissionId)) {
        throw new Error(
          "System administrator permissions cannot be removed in this phase.",
        );
      }
    }
  }

  if (role.key === "member") {
    const protectedPermissions = await admin
      .from("permissions")
      .select("id, key, is_active")
      .in("key", Array.from(MEMBER_PROTECTED_PERMISSION_KEYS));

    if (protectedPermissions.error) {
      throw new Error(protectedPermissions.error.message);
    }

    for (const permission of (protectedPermissions.data ?? []) as PermissionMutationRecord[]) {
      if (
        currentPermissionIds.has(permission.id) &&
        !desiredPermissionIds.has(permission.id)
      ) {
        throw new Error(
          "The member role must retain profile.view and profile.update.",
        );
      }
    }
  }

  const roleIdsToAdd = permissionIds.filter(
    (permissionId) => !currentPermissionIds.has(permissionId),
  );
  const roleIdsToRemove = Array.from(currentPermissionIds).filter(
    (permissionId) => !desiredPermissionIds.has(permissionId),
  );

  // Add first. If a later delete fails, existing permissions are preserved and
  // the action reports the incomplete update instead of silently losing access.
  if (roleIdsToAdd.length > 0) {
    const { error: insertError } = await admin
      .from("role_permissions")
      .insert(
        roleIdsToAdd.map((permissionId) => ({
          role_id: role.id,
          permission_id: permissionId,
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  if (roleIdsToRemove.length > 0) {
    const { error: deleteError } = await admin
      .from("role_permissions")
      .delete()
      .eq("role_id", role.id)
      .in("permission_id", roleIdsToRemove);

    if (deleteError) {
      throw new Error(
        "Some new permissions were added, but old permissions could not be removed. Review the role before trying again.",
      );
    }
  }

  revalidateRolePaths(role.id);

  return { success: true };
}

type RoleLifecycleOperation = "activate" | "deactivate" | "delete";

function translateRoleLifecycleError(message: string) {
  const knownMessages = new Set([
    "Role not found.",
    "The system_admin role cannot be deactivated.",
    "The member role cannot be deactivated.",
    "System roles cannot be deleted.",
    "This change would remove the last active RBAC administrator role.",
    "This change would leave no active account with RBAC administration access.",
    "Unsupported role lifecycle operation.",
  ]);

  if (knownMessages.has(message)) {
    return message;
  }

  if (/^This role is assigned to \d+ account(s)?\./.test(message)) {
    return message;
  }

  return "The role lifecycle change could not be completed. Refresh the page and try again.";
}

async function executeRoleLifecycleOperation(
  admin: ReturnType<typeof createAdminClient>,
  roleId: string,
  operation: RoleLifecycleOperation,
) {
  const { data, error } = await admin.rpc("manage_role_lifecycle", {
    target_role_id: roleId,
    operation,
  });

  if (error) {
    throw new Error(translateRoleLifecycleError(error.message));
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("success" in data) ||
    data.success !== true
  ) {
    throw new Error(
      "The role lifecycle change returned an invalid result. Refresh the page and try again.",
    );
  }

  revalidateRolePaths(roleId);

  return { success: true, roleId };
}

export async function setRoleActiveState(
  roleId: string,
  nextIsActive: boolean,
) {
  await requirePermission("roles.deactivate");

  if (typeof roleId !== "string" || !roleId.trim()) {
    throw new Error("A role is required.");
  }

  if (typeof nextIsActive !== "boolean") {
    throw new Error("Invalid role status.");
  }

  const admin = createAdminClient();

  return executeRoleLifecycleOperation(
    admin,
    roleId.trim(),
    nextIsActive ? "activate" : "deactivate",
  );
}

export async function deleteCustomRole(roleId: string) {
  await requirePermission("roles.delete");

  if (typeof roleId !== "string" || !roleId.trim()) {
    throw new Error("A role is required.");
  }

  const admin = createAdminClient();

  return executeRoleLifecycleOperation(admin, roleId.trim(), "delete");
}
