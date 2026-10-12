"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  UsersRound,
  UserRoundCog,
  CalendarDays,
  ClipboardCheck,
  HandCoins,
  Droplets,
  HeartHandshake,
  BarChart3,
  Settings,
  UserRound,
  SlidersHorizontal,
  IdCardLanyard,
} from "lucide-react";

import {
  hasAnyPermission,
  hasPermission,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/permissions";

type PortalNavigationProps = {
  permissions: readonly PermissionKey[];
  variant: "desktop" | "mobile";
};

const navigationItems: {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: PermissionKey;
  canView?: (permissions: readonly PermissionKey[]) => boolean;
}[] = [
    {
      label: "Dashboard",
      href: "/portal",
      icon: LayoutDashboard,
      requiredPermission: "dashboard.view",
    },
    {
      label: "Members",
      href: "/portal/members",
      icon: UsersRound,
      requiredPermission: "members.view",
    },
    {
      label: "Accounts",
      href: "/portal/accounts",
      icon: UserRoundCog,
      requiredPermission: "accounts.view",
    },
    {
      label: "Services",
      href: "/portal/services",
      icon: CalendarDays,
      requiredPermission: "services.view",
    },
    {
      label: "Attendance",
      href: "/portal/attendance",
      icon: ClipboardCheck,
      requiredPermission: "attendance.view",
    },
    {
      label: "Contributions",
      href: "/portal/contributions",
      icon: HandCoins,
      requiredPermission: "contributions.view",
    },
    {
      label: "Baptisms",
      href: "/portal/baptisms",
      icon: Droplets,
      requiredPermission: "baptisms.view",
    },
    {
      label: "Weddings",
      href: "/portal/weddings",
      icon: HeartHandshake,
      requiredPermission: "weddings.view",
    },
    {
      label: "Reports",
      href: "/portal/reports",
      icon: BarChart3,
      requiredPermission: "reports.view",
    },
    {
      label: "Administration",
      href: "/portal/administration",
      icon: Settings,
      requiredPermission: "administration.view",
    },
    {
      label: "Profile",
      href: "/portal/profile",
      icon: IdCardLanyard,
      requiredPermission: "profile.view",
    },
    {
      label: "Field Management",
      href: "/portal/field-management",
      icon: SlidersHorizontal,
      // Field Management configures system-wide profile fields, so it belongs
      // to administration rather than member-record editing.
      requiredPermission: "administration.view",
    },
    {
      label: "My Account",
      href: "/portal/account",
      icon: UserRound,
      // There is no dedicated self-account permission in the established
      // catalog. Keep this available to any authenticated portal capability
      // without falling back to role names.
      canView: (permissions) =>
        hasAnyPermission(permissions, PERMISSION_KEYS),
    },
  ];

export default function PortalNavigation({
  permissions,
  variant,
}: PortalNavigationProps) {
  const pathname = usePathname();

  const visibleItems = navigationItems.filter((item) =>
    item.requiredPermission
      ? hasPermission(permissions, item.requiredPermission)
      : item.canView?.(permissions) ?? false,
  );

  if (variant === "mobile") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white md:hidden">
        <div className="flex items-center overflow-x-auto px-2 py-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition ${isActive
                  ? "bg-[#EEF3FB] text-[#203264]"
                  : "text-muted-foreground hover:bg-[#F8FAFD] hover:text-[#203264]"
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {visibleItems.map((item) => {
        const Icon = item.icon;

        const isActive =
          pathname === item.href ||
          (item.href !== "/portal" &&
            pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${isActive
              ? "bg-[#EEF3FB] text-[#203264]"
              : "text-muted-foreground hover:bg-[#EEF3FB] hover:text-[#203264]"
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
