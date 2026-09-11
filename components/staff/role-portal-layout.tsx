import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import StaffMobileMenu from "./staff-mobile-menu";

import {
  LogOut
} from "lucide-react";

import { requireRole } from "@/lib/auth";
import {
  getStaffPortalPath,
  type StaffRole,
} from "@/lib/staff-roles";


import { logoutStaff } from "@/app/staff/actions";
import StaffDesktopNavigation from "./staff-desktop-navigation";

type RolePortalLayoutProps = {
  role: StaffRole;
  title: string;
  children: ReactNode;
};

export async function RolePortalLayout({
  role,
  title,
  children,
}: Readonly<RolePortalLayoutProps>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalShell role={role} title={title}>
        {children}
      </RolePortalShell>
    </Suspense>
  );

}

async function RolePortalShell({
  role,
  title,
  children,
}: Readonly<RolePortalLayoutProps>) {
  const { user } = await requireRole(role);

  return (
    <div className="min-h-screen bg-[#EEF3FB] md:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-[#203264] to-[#10192E] text-white md:sticky md:top-0 md:flex">
        {/* BRAND */}
        <div className="border-b border-white/10 px-5 py-5">
          <Link
            href={getStaffPortalPath(role)}
            className="flex items-center gap-3"
          >
            <div className="rounded-full p-1">
              <Image
                src="/upc-logo.png"
                alt="UPC Connect"
                width={44}
                height={44}
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="font-heading text-base font-semibold">
                UPC CONNECT
              </p>

              <p className="truncate text-xs text-white/60">
                {title}
              </p>
            </div>
          </Link>
        </div>

        {/* NAVIGATION */}
        <StaffDesktopNavigation role={role} />

        {/* ACCOUNT */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Signed in as
            </p>

            <p
              className="mt-1 truncate text-xs text-white/70"
              title={user.email ?? ""}
            >
              {user.email}
            </p>
          </div>

          <form action={logoutStaff}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <Image
            src="/upc-logo.png"
            alt="UPC Connect"
            width={38}
            height={38}
            priority
          />

          <div>
            <p className="font-heading text-sm font-semibold text-[#203264]">
              UPC CONNECT
            </p>

            <p className="text-[11px] text-muted-foreground">
              {title}
            </p>
          </div>
        </div>

        <StaffMobileMenu
          role={role}
          title={title}
          email={user.email}
        />
      </header>

      {/* CONTENT */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

export function RolePortalLoading() {
  return (
    <div className="min-h-screen bg-[#EEF3FB] md:flex">
      <aside className="hidden h-screen w-64 shrink-0 bg-[#203264] p-5 md:block">
        <div className="h-11 w-40 animate-pulse rounded-xl bg-white/10" />

        <div className="mt-8 space-y-3">
          <div className="h-11 animate-pulse rounded-xl bg-white/10" />
          <div className="h-11 animate-pulse rounded-xl bg-white/10" />
          <div className="h-11 animate-pulse rounded-xl bg-white/10" />
        </div>
      </aside>

      <main
        className="min-w-0 flex-1 p-4 sm:p-6 md:p-8"
        aria-busy="true"
      >
        <div className="h-8 w-56 animate-pulse rounded bg-white" />
        <div className="mt-4 h-5 w-72 max-w-full animate-pulse rounded bg-white" />
      </main>
    </div>
  );
}