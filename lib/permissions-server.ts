import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  isPermissionKey,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

type RelatedRecord<T> = T | T[] | null | undefined;

type UserRoleRow = {
  role_id: string | null;
  roles: RelatedRecord<{
    key: string | null;
    is_active: boolean | null;
  }>;
};

type RolePermissionRow = {
  role_id: string | null;
  permissions: RelatedRecord<{
    key: string | null;
    is_active: boolean | null;
  }>;
};

function firstRelatedRecord<T>(
  relation: RelatedRecord<T>,
): T | null {
  return Array.isArray(relation)
    ? relation[0] ?? null
    : relation ?? null;
}

function permissionLoadError(error: unknown): Error {
  console.error("Failed to load effective account permissions.", error);
  return new Error("Unable to verify account permissions.");
}

async function loadPermissionsForUser(
  userId: string,
): Promise<PermissionKey[]> {
  const supabase = await createClient();

  const { data: roleLinks, error: roleLinksError } = await supabase
    .from("user_roles")
    .select(`
      role_id,
      roles!inner (
        key,
        is_active
      )
    `)
    .eq("user_id", userId);

  if (roleLinksError) {
    throw permissionLoadError(roleLinksError);
  }

  const activeRoleIds = (roleLinks as UserRoleRow[] | null ?? [])
    .filter((link) => {
      const role = firstRelatedRecord(link.roles);
      return Boolean(role?.is_active && link.role_id);
    })
    .map((link) => link.role_id as string);

  if (activeRoleIds.length === 0) {
    return [];
  }

  const { data: rolePermissions, error: rolePermissionsError } =
    await supabase
      .from("role_permissions")
      .select(`
        role_id,
        permissions!inner (
          key,
          is_active
        )
      `)
      .in("role_id", activeRoleIds);

  if (rolePermissionsError) {
    throw permissionLoadError(rolePermissionsError);
  }

  const effectiveKeys = new Set<PermissionKey>();

  for (const link of rolePermissions as RolePermissionRow[] | null ?? []) {
    const permission = firstRelatedRecord(link.permissions);

    if (
      permission?.is_active &&
      permission.key &&
      isPermissionKey(permission.key)
    ) {
      effectiveKeys.add(permission.key);
    }
  }

  // Return the keys in catalog order instead of depending on join row order.
  return PERMISSION_KEYS.filter((key) => effectiveKeys.has(key));
}

export async function getCurrentUserPermissions(
  userId?: string,
): Promise<PermissionKey[]> {
  const targetUserId = userId ?? (await getCurrentUser())?.id;

  if (!targetUserId) {
    return [];
  }

  return loadPermissionsForUser(targetUserId);
}

export type PermissionContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  permissions: PermissionKey[];
};

export async function requirePermission(
  permission: PermissionKey,
): Promise<PermissionContext> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let permissions: PermissionKey[];

  try {
    permissions = await loadPermissionsForUser(user.id);
  } catch {
    // Permission-loading failures never grant access. Keep the response
    // aligned with the existing portal authorization pattern.
    redirect("/access-denied");
  }

  if (!hasPermission(permissions, permission)) {
    redirect("/access-denied");
  }

  return {
    user,
    permissions,
  };
}
