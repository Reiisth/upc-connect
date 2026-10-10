import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  hasAnyPermission,
  hasPermission,
  type PermissionCollection,
} from "@/lib/permissions";
import {
  getCurrentUserPermissions,
  requirePermission,
  type PermissionContext,
} from "@/lib/permissions-server";
import {
  getUserBranchScope,
  type BranchScope,
} from "@/lib/branch-access";

import {
  BAPTISM_TYPES,
  type BaptismType,
} from "./types";

export type BaptismPermission =
  | "baptisms.view"
  | "baptisms.water.create"
  | "baptisms.water.update"
  | "baptisms.holy_ghost.create"
  | "baptisms.holy_ghost.update";

export const BAPTISM_CREATE_PERMISSIONS = [
  "baptisms.water.create",
  "baptisms.holy_ghost.create",
] as const satisfies readonly BaptismPermission[];

export const BAPTISM_UPDATE_PERMISSIONS = [
  "baptisms.water.update",
  "baptisms.holy_ghost.update",
] as const satisfies readonly BaptismPermission[];

export type BaptismAccess = PermissionContext & BranchScope;

export function getBaptismCreatePermission(
  baptismType: string,
): BaptismPermission | null {
  if (baptismType === "water") {
    return "baptisms.water.create";
  }

  if (baptismType === "holy_ghost") {
    return "baptisms.holy_ghost.create";
  }

  return null;
}

export function getBaptismUpdatePermission(
  baptismType: string,
): BaptismPermission | null {
  if (baptismType === "water") {
    return "baptisms.water.update";
  }

  if (baptismType === "holy_ghost") {
    return "baptisms.holy_ghost.update";
  }

  return null;
}

export function getAllowedBaptismCreateTypes(
  permissions: PermissionCollection,
): BaptismType[] {
  return BAPTISM_TYPES.filter((baptismType) => {
    const permission = getBaptismCreatePermission(baptismType);
    return permission !== null && hasPermission(permissions, permission);
  });
}

export async function requireBaptismPermission(
  permission: BaptismPermission,
): Promise<BaptismAccess> {
  const permissionContext = await requirePermission(permission);
  const branchScope = await getUserBranchScope(
    permissionContext.user.id,
  );

  return {
    ...permissionContext,
    ...branchScope,
  };
}

async function requireAnyBaptismPermission(
  permissionsToRequire: readonly BaptismPermission[],
): Promise<BaptismAccess> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let permissions;

  try {
    permissions = await getCurrentUserPermissions(user.id);
  } catch (error) {
    console.error("Failed to load Baptisms permissions.", error);
    redirect("/access-denied");
  }

  if (!hasAnyPermission(permissions, permissionsToRequire)) {
    redirect("/access-denied");
  }

  const branchScope = await getUserBranchScope(user.id);

  return {
    user,
    permissions,
    ...branchScope,
  };
}

export function requireBaptismCreateAccess() {
  return requireAnyBaptismPermission(BAPTISM_CREATE_PERMISSIONS);
}

export function requireBaptismUpdateAccess() {
  return requireAnyBaptismPermission(BAPTISM_UPDATE_PERMISSIONS);
}
