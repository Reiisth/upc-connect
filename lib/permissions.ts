/**
 * The application-facing permission catalog.
 *
 * Permission keys are stable identifiers. Display labels belong to the
 * database and administration UI, so callers should authorize with these
 * keys rather than role names or display names.
 */
export const PERMISSION_KEYS = [
  "accounts.archive",
  "accounts.invite",
  "accounts.manage_branch_access",
  "accounts.manage_roles",
  "accounts.restore",
  "accounts.update_display_name",
  "accounts.view",
  "administration.view",
  "attendance.correct",
  "attendance.record",
  "attendance.view",
  "baptisms.holy_ghost.create",
  "baptisms.holy_ghost.update",
  "baptisms.view",
  "baptisms.water.create",
  "baptisms.water.update",
  "branches.manage",
  "branches.view",
  "contributions.create",
  "contributions.update",
  "contributions.view",
  "dashboard.view",
  "members.archive",
  "members.create",
  "members.link_account",
  "members.update",
  "members.view",
  "profile.update",
  "profile.view",
  "reports.view",
  "roles.assign",
  "roles.create",
  "roles.deactivate",
  "roles.delete",
  "roles.manage_permissions",
  "roles.update",
  "roles.view",
  "services.create",
  "services.update",
  "services.view",
  "weddings.create",
  "weddings.update",
  "weddings.view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionCollection =
  | readonly string[]
  | ReadonlySet<string>;

const permissionKeySet = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(
  value: string,
): value is PermissionKey {
  return permissionKeySet.has(value);
}

export function hasPermission(
  permissions: PermissionCollection,
  requiredPermission: PermissionKey,
): boolean {
  if ("has" in permissions) {
    return permissions.has(requiredPermission);
  }

  return permissions.includes(requiredPermission);
}

export function hasAnyPermission(
  permissions: PermissionCollection,
  requiredPermissions: readonly PermissionKey[],
): boolean {
  return requiredPermissions.some((permission) =>
    hasPermission(permissions, permission),
  );
}
