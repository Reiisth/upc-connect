import { redirect } from "next/navigation";

import {
  canAccessTab,
} from "@/lib/portal-access";
import {
  getCurrentUser,
  getCurrentUserRoles,
} from "@/lib/auth";
import { requirePortalTab } from "@/lib/require-portal-tab";

export type BaptismAccess = Awaited<
  ReturnType<typeof requirePortalTab>
>;

/**
 * Spiritual ministry officers and pastors use the baptism tab. System
 * administrators use their existing accounts permission for system-wide,
 * view-only oversight.
 */
export async function requireBaptismsAccess() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (roles.includes("system_admin")) {
    return requirePortalTab("accounts");
  }

  if (!canAccessTab(roles, "baptisms")) {
    redirect("/access-denied");
  }

  return requirePortalTab("baptisms");
}

export function canManageBaptisms(access: BaptismAccess) {
  return (
    !access.isSystemAdmin &&
    access.roles.includes("spiritual_ministry_officer")
  );
}

export async function requireBaptismManager() {
  const access = await requireBaptismsAccess();

  if (!canManageBaptisms(access)) {
    throw new Error(
      "Only spiritual ministry officers can create or edit baptism records. Pastors and system administrators have view-only access.",
    );
  }

  return access;
}
