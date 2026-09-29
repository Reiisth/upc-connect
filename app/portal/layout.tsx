import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutPortal } from "./actions";

import { getCurrentUser, getCurrentUserRoles } from "@/lib/auth";
import PortalNavigation from "./PortalNavigation";

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
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getCurrentUserRoles(user.id);

  return (
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
          roles={roles}
          variant="desktop"
        />

        <div className="border-t p-4">
          <form action={logoutPortal}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
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

          <form action={logoutPortal}>
            <button
              type="submit"
              aria-label="Logout"
              title="Logout"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>

        <main className="min-w-0 pb-24 md:pb-0">
          <div className="p-5 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE NAV */}
      <PortalNavigation
        roles={roles}
        variant="mobile"
      />
    </div>
  );
}

function PortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EEF3FB]">
      <p className="text-sm text-muted-foreground">
        Loading portal...
      </p>
    </div>
  );
}