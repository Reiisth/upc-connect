import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/lib/permissions-server";

const portalDestinations = [
  // There is currently no concrete /portal/dashboard route. Dashboard
  // visibility remains permission-based in PortalNavigation, while this
  // resolver falls through to the first concrete portal destination.
  { permission: "members.view", href: "/portal/members" },
  { permission: "accounts.view", href: "/portal/accounts" },
  { permission: "services.view", href: "/portal/services" },
  { permission: "attendance.view", href: "/portal/attendance" },
  { permission: "contributions.view", href: "/portal/contributions" },
  { permission: "baptisms.view", href: "/portal/baptisms" },
  { permission: "reports.view", href: "/portal/reports" },
  { permission: "administration.view", href: "/portal/administration" },
  { permission: "profile.view", href: "/portal/profile" },
] as const;

export default async function PortalPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const permissions = await getCurrentUserPermissions(user.id);

  for (const destination of portalDestinations) {
    if (hasPermission(permissions, destination.permission)) {
      redirect(destination.href);
    }
  }

  redirect("/access-denied");
}
