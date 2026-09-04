import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { getStaffPortalPath, type StaffRole } from "@/lib/staff-roles";

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
  const { user } = await requireRole(role);

  return (
    <div className="min-h-screen bg-muted/30 md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b bg-background p-4 md:min-h-screen md:border-b-0 md:border-r">
        <Link href={getStaffPortalPath(role)} className="text-lg font-semibold">
          UPC Connect
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">{title}</p>

        <nav className="mt-6" aria-label={`${title} navigation`}>
          <Link
            href={getStaffPortalPath(role)}
            className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
          >
            Dashboard
          </Link>

          {role === "system_admin" && (
            <Link
              href="/staff/admin/members"
              className="block rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              Members
            </Link>
          )}
        </nav>
        
        <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          <p className="truncate">{user.email}</p>
        </div>
      </aside>

      <main className="p-6 md:p-8">{children}</main>
    </div>
  );
}

export function RolePortalLoading() {
  return (
    <div className="min-h-screen bg-muted/30 md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b bg-background p-4 md:min-h-screen md:border-b-0 md:border-r">
        <div className="h-6 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-9 animate-pulse rounded bg-muted" />
      </aside>
      <main className="p-6 md:p-8" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-5 w-72 max-w-full animate-pulse rounded bg-muted" />
      </main>
    </div>
  );
}
