"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  UsersRound,
  UserCog,
  LogOut,
} from "lucide-react";

import { logoutStaff } from "@/app/staff/actions";
import {
  getStaffPortalPath,
  type StaffRole,
} from "@/lib/staff-roles";

type StaffMobileMenuProps = {
  role: StaffRole;
  title: string;
  email?: string | null;
};

export default function StaffMobileMenu({
  role,
  title,
  email,
}: StaffMobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navigation = [
    {
      href: getStaffPortalPath(role),
      label: "Dashboard",
      icon: LayoutDashboard,
    },

    ...(role === "system_admin"
      ? [
          {
            href: "/staff/admin/members",
            label: "Members",
            icon: UsersRound,
          },
          {
            href: "/staff/admin/accounts",
            label: "Accounts",
            icon: UserCog,
          },
        ]
      : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open staff menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#203264] transition hover:bg-[#EEF3FB]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-heading text-base font-semibold text-[#203264]">
                  UPC CONNECT
                </p>

                <p className="text-xs text-muted-foreground">
                  {title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-[#EEF3FB]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-2 p-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-[#EEF3FB] text-[#203264]"
                        : "text-muted-foreground hover:bg-[#EEF3FB]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t p-4">
              <div className="mb-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Signed in as
                </p>

                <p className="mt-1 truncate text-xs text-[#203264]">
                  {email}
                </p>
              </div>

              <form action={logoutStaff}>
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
        </div>
      )}
    </>
  );
}