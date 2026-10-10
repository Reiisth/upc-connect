import "server-only";

import {
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import type { PermissionKey } from "@/lib/permissions";

export type AdministrationPermission = PermissionKey;

export async function requireAdministrationPermission(
  permission: AdministrationPermission,
): Promise<PermissionContext> {
  return requirePermission(permission);
}
