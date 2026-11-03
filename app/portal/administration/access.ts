import "server-only";

import { redirect } from "next/navigation";
import { requireActiveAccount } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import type { PermissionKey } from "@/lib/permissions";

export type AdministrationPermission = PermissionKey;

/** The hub exposes only links; each destination still enforces its own permission. */
export async function getAdministrationHubPermissions() {
  const { user } = await requireActiveAccount();
  const permissions = await getCurrentUserPermissions(user.id);
  const canReachHub = hasAnyPermission(permissions, [
    "administration.view",
    "branches.view",
    "roles.view",
    "departments.view",
    "departments.manage",
    "service_types.view",
    "service_types.manage",
  ]);

  if (!canReachHub) redirect("/access-denied");
  return permissions;
}

export async function requireAdministrationPermission(
  permission: AdministrationPermission,
): Promise<PermissionContext> {
  return requirePermission(permission);
}
