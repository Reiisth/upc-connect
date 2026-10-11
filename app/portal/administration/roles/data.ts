import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  PermissionRecord,
  RoleDetailData,
  RoleOverview,
  RoleRecord,
} from "./types";

type RolePermissionCountRow = {
  role_id: string | null;
  permission_id: string | null;
};

type UserRoleCountRow = {
  role_id: string | null;
  user_id: string | null;
};

export async function getRolesOverview(): Promise<RoleOverview[]> {
  const admin = createAdminClient();

  const [
    { data: roleRows, error: rolesError },
    { data: permissionLinks, error: permissionLinksError },
    { data: userRoleLinks, error: userRoleLinksError },
  ] = await Promise.all([
    admin
      .from("roles")
      .select(
        "id, key, name, display_name, description, is_system, is_staff, is_active, created_at",
      )
      .order("is_system", { ascending: false })
      .order("display_name", { ascending: true }),

    admin
      .from("role_permissions")
      .select("role_id, permission_id"),

    admin
      .from("user_roles")
      .select("role_id, user_id"),
  ]);

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  if (permissionLinksError) {
    throw new Error(permissionLinksError.message);
  }

  if (userRoleLinksError) {
    throw new Error(userRoleLinksError.message);
  }

  const permissionCounts = new Map<string, number>();

  for (const link of (permissionLinks ?? []) as RolePermissionCountRow[]) {
    if (!link.role_id) continue;

    permissionCounts.set(
      link.role_id,
      (permissionCounts.get(link.role_id) ?? 0) + 1,
    );
  }

  const usersByRole = new Map<string, Set<string>>();

  for (const link of (userRoleLinks ?? []) as UserRoleCountRow[]) {
    if (!link.role_id || !link.user_id) continue;

    const users = usersByRole.get(link.role_id) ?? new Set<string>();
    users.add(link.user_id);
    usersByRole.set(link.role_id, users);
  }

  return ((roleRows ?? []) as RoleRecord[]).map((role) => ({
    ...role,
    assigned_permission_count: permissionCounts.get(role.id) ?? 0,
    assigned_user_count: usersByRole.get(role.id)?.size ?? 0,
  }));
}

export async function getActivePermissions(): Promise<PermissionRecord[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("permissions")
    .select("id, key, name, description, is_active")
    .eq("is_active", true)
    .order("key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PermissionRecord[];
}

export async function getRoleDetail(
  roleId: string,
): Promise<RoleDetailData | null> {
  const admin = createAdminClient();

  const [
    { data: role, error: roleError },
    { data: permissions, error: permissionsError },
    { data: links, error: linksError },
  ] = await Promise.all([
    admin
      .from("roles")
      .select(
        "id, key, name, display_name, description, is_system, is_staff, is_active, created_at",
      )
      .eq("id", roleId)
      .maybeSingle(),

    admin
      .from("permissions")
      .select("id, key, name, description, is_active")
      .order("key", { ascending: true }),

    admin
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId),
  ]);

  if (roleError) {
    throw new Error(roleError.message);
  }

  if (permissionsError) {
    throw new Error(permissionsError.message);
  }

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (!role) {
    return null;
  }

  return {
    role: role as RoleRecord,
    permissions: (permissions ?? []) as PermissionRecord[],
    currentPermissionIds: Array.from(
      new Set(
        (links ?? [])
          .map((link) => link.permission_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  };
}
