import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentUserRoles } from "@/lib/auth";
import { canAccessTab } from "@/lib/portal-access";

export default async function PortalPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  if (canAccessTab(roles, "dashboard")) {
    redirect("/portal/dashboard");
  }

  if (canAccessTab(roles, "members")) {
    redirect("/portal/members");
  }

  if (canAccessTab(roles, "accounts")) {
    redirect("/portal/accounts");
  }

  if (canAccessTab(roles, "attendance")) {
    redirect("/portal/attendance");
  }

  if (canAccessTab(roles, "contributions")) {
    redirect("/portal/contributions");
  }

  if (canAccessTab(roles, "baptisms")) {
    redirect("/portal/baptisms");
  }

  if (canAccessTab(roles, "reports")) {
    redirect("/portal/reports");
  }

  if (canAccessTab(roles, "administration")) {
    redirect("/portal/administration");
  }

  if (canAccessTab(roles, "profile")) {
    redirect("/portal/profile");
  }

  redirect("/access-denied");
}