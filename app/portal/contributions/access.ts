import { redirect } from "next/navigation";

import {
  canAccessTab,
} from "@/lib/portal-access";
import {
  getCurrentUser,
  getCurrentUserRoles,
} from "@/lib/auth";
import { requirePortalTab } from "@/lib/require-portal-tab";

export type ContributionAccess = Awaited<
  ReturnType<typeof requirePortalTab>
>;

/**
 * Contributions use the existing contributions permission for operational
 * users. System administrators use their existing accounts permission for
 * system-wide, view-only oversight.
 */
export async function requireContributionsAccess() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (roles.includes("system_admin")) {
    return requirePortalTab("accounts");
  }

  if (!canAccessTab(roles, "contributions")) {
    redirect("/access-denied");
  }

  return requirePortalTab("contributions");
}

export function canManageContributions(
  access: ContributionAccess,
) {
  return (
    !access.isSystemAdmin &&
    access.roles.includes("accounting_officer")
  );
}

export async function requireContributionManager() {
  const access = await requireContributionsAccess();

  if (!canManageContributions(access)) {
    throw new Error(
      "Only accounting officers can create or edit contributions. Pastors and system administrators have view-only access.",
    );
  }

  return access;
}
