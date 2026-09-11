"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UsersRound,
  UserCog,
} from "lucide-react";

import {
  getStaffPortalPath,
  type StaffRole,
} from "@/lib/staff-roles";

type StaffDesktopNavigationProps = {
  role: StaffRole;
};

export default function StaffDesktopNavigation({
  role,
}: StaffDesktopNavigationProps) {
  const pathname = usePathname();

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
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {navigation.map((item) => {
        const Icon = item.icon;

        const isActive =
          item.href === getStaffPortalPath(role)
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "bg-white/15 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}