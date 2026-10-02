"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  UsersRound,
  UserRoundCog,
  ClipboardCheck,
  HandCoins,
  Droplets,
  BarChart3,
  Settings,
  UserRound,
  SlidersHorizontal,
  IdCardLanyard,
} from "lucide-react";

import {
  canAccessTab,
  type PortalTab,
} from "@/lib/portal-access";

type PortalNavigationProps = {
  roles: string[];
  variant: "desktop" | "mobile";
};

const navigationItems: {
  tab: PortalTab;
  label: string;
  href: string;
  icon: React.ElementType;
}[] = [
    {
      tab: "dashboard",
      label: "Dashboard",
      href: "/portal",
      icon: LayoutDashboard,
    },
    {
      tab: "members",
      label: "Members",
      href: "/portal/members",
      icon: UsersRound,
    },
    {
      tab: "accounts",
      label: "Accounts",
      href: "/portal/accounts",
      icon: UserRoundCog,
    },
    {
      tab: "attendance",
      label: "Attendance",
      href: "/portal/attendance",
      icon: ClipboardCheck,
    },
    {
      tab: "contributions",
      label: "Contributions",
      href: "/portal/contributions",
      icon: HandCoins,
    },
    {
      tab: "baptisms",
      label: "Baptisms",
      href: "/portal/baptisms",
      icon: Droplets,
    },
    {
      tab: "reports",
      label: "Reports",
      href: "/portal/reports",
      icon: BarChart3,
    },
    {
      tab: "administration",
      label: "Administration",
      href: "/portal/administration",
      icon: Settings,
    },
    {
      tab: "profile",
      label: "Profile",
      href: "/portal/profile",
      icon: IdCardLanyard,
    },
    {
      tab: "field_management",
      label: "Field Management",
      href: "/portal/field-management",
      icon: SlidersHorizontal,
    },
    {
      tab: "account",
      label: "My Account",
      href: "/portal/account",
      icon: UserRound,
    },
  ];

export default function PortalNavigation({
  roles,
  variant,
}: PortalNavigationProps) {
  const pathname = usePathname();

  const visibleItems = navigationItems.filter((item) =>
    canAccessTab(roles, item.tab),
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
                key={item.tab}
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
            key={item.tab}
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