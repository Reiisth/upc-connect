import { redirect } from "next/navigation";

import { getCurrentUser, getCurrentUserRoles } from "@/lib/auth";
import {
  canAccessTab,
  type PortalTab,
} from "@/lib/portal-access";

export async function requirePortalTab(tab: PortalTab) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (!canAccessTab(roles, tab)) {
    redirect("/access-denied");
  }

  return {
    user,
    roles,
  };
}