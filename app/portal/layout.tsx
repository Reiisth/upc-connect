import { PortalLoading } from "@/components/ui/portal-loading";
import { Suspense } from "react";

import { requireActiveAccount } from "@/lib/auth";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import { portalSessionRevision } from "@/lib/portal-session-revision";
import PortalRuntime from "./PortalRuntime";
import PortalNavigation, { getPortalNavigationRoutes } from "./PortalNavigation";
import { getPortalUserContext } from "@/lib/portal-user-context";
import PortalFrame from "./PortalFrame";
import { getPortalBranchContext } from "@/lib/portal-branch-server";

// Limit partial-prefetch adoption to the authenticated portal route tree.
export const prefetch = "partial";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PortalLoading />}>
      <PortalShell>{children}</PortalShell>
    </Suspense>
  );
}

async function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireActiveAccount();

  const permissions = await getCurrentUserPermissions(user.id);
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.full_name;
  const [identity, branchContext] = await Promise.all([getPortalUserContext(
    user.id,
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email ?? "Account",
  ), getPortalBranchContext()]);
  const scope = branchContext.scope;

  return (
    <PortalRuntime userId={user.id} revision={portalSessionRevision(user.id, permissions, scope.branchIds, scope.isSystemAdmin)} routes={getPortalNavigationRoutes(permissions)}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-[#203264] focus:shadow-lg focus:outline focus:outline-2 focus:outline-[#365FA6]">Skip to main content</a>
    <PortalFrame userId={user.id} identity={identity} branches={branchContext.branches} branchId={branchContext.branchId}
      desktopNavigation={<PortalNavigation permissions={permissions} variant="desktop" />}
      mobileNavigation={<PortalNavigation permissions={permissions} variant="mobile" />}>{children}</PortalFrame>
    </PortalRuntime>
  );
}
