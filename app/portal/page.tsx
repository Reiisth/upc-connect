import { redirect } from "next/navigation";
import { requireActiveAccount } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/lib/permissions-server";

const workspaceDestinations = [
  ["members.view", "/portal/members"],
  ["services.view", "/portal/services"],
  ["attendance.view", "/portal/attendance"],
  ["inactivity.view", "/portal/inactivity"],
  ["follow_ups.view", "/portal/follow-ups"],
  ["contributions.view", "/portal/contributions"],
  ["baptisms.view", "/portal/baptisms"],
] as const;

export default async function PortalPage() {
  const { user } = await requireActiveAccount();
  const permissions = await getCurrentUserPermissions(user.id);

  if (hasPermission(permissions, "reports.view")) {
    redirect("/portal/reports");
  }

  for (const [permission, href] of workspaceDestinations) {
    if (hasPermission(permissions, permission)) redirect(href);
  }

  if (hasAnyPermission(permissions, ["accounts.view", "accounts.manage_branch_access"])) {
    redirect(hasPermission(permissions, "accounts.view") ? "/portal/accounts" : "/portal/accounts/staff");
  }

  if (hasAnyPermission(permissions, ["administration.view", "branches.view", "roles.view"])) {
    redirect("/portal/administration");
  }

  if (hasPermission(permissions, "profile.view")) {
    redirect("/portal/profile");
  }

  redirect("/access-denied");
}
