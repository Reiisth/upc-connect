import { PortalLoading } from "@/components/ui/portal-loading";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { logoutPortal } from "./actions";

import { requireActiveAccount } from "@/lib/auth";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import { getUserBranchScope } from "@/lib/branch-access";
import { portalSessionRevision } from "@/lib/portal-session-revision";
import PortalRuntime from "./PortalRuntime";
import PortalNavigation, { getPortalNavigationRoutes } from "./PortalNavigation";
import { getPortalUserContext } from "@/lib/portal-user-context";
import { PortalIdentitySummary } from "./PortalIdentitySummary";
import MobileProfileInfo from "./MobileProfileInfo";

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
  const [identity, scope] = await Promise.all([getPortalUserContext(
    user.id,
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email ?? "Account",
  ), getUserBranchScope(user.id)]);

  return (
    <PortalRuntime userId={user.id} revision={portalSessionRevision(user.id, permissions, scope.branchIds, scope.isSystemAdmin)} routes={getPortalNavigationRoutes(permissions)}>
    <div className="min-h-screen bg-[#EEF3FB] md:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-white md:sticky md:top-0 md:flex">
        <div className="flex items-center gap-3 border-b px-5 py-5">
          <Image
            src="/upc-logo.png"
            alt="UPC Connect"
            width={44}
            height={44}
            priority
          />

          <div>
            <p className="font-heading text-lg font-semibold text-[#203264]">
              UPC CONNECT
            </p>

            <p className="text-xs text-muted-foreground">
              Unified Portal
            </p>
          </div>
        </div>

        <PortalNavigation
          permissions={permissions}
          variant="desktop"
        />

        <div className="space-y-4 border-t p-4">
          <PortalIdentitySummary context={identity} />
          <form action={logoutPortal}>
            <Button
              variant="ghost" pendingLabel="Signing out..."
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="min-w-0 flex-1">
        {/* MOBILE HEADER */}
        <div className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Image
              src="/upc-logo.png"
              alt="UPC Connect"
              width={36}
              height={36}
            />

            <div>
              <p className="font-heading text-sm font-semibold text-[#203264]">
                UPC CONNECT
              </p>

              <p className="text-[10px] text-muted-foreground">
                Unified Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <MobileProfileInfo><PortalIdentitySummary context={identity} /></MobileProfileInfo>
          <form action={logoutPortal}>
            <Button
              variant="ghost" pendingLabel="Signing out..."
              type="submit"
              aria-label="Logout"
              title="Logout"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </form>
          </div>
        </div>

        <main className="min-w-0 pb-24 md:pb-0">
          <div className="p-2 sm:p-3 lg:p-4">
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE NAV */}
      <PortalNavigation
        permissions={permissions}
        variant="mobile"
      />
    </div>
    </PortalRuntime>
  );
}
