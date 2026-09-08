"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserRound,
  CalendarDays,
  WalletCards,
} from "lucide-react";

type MemberNavigationProps = {
  variant: "desktop" | "mobile";
};

const navigation = [
  {
    href: "/member",
    label: "Member Information",
    icon: UserRound,
  },
  {
    href: "/member/attendance",
    label: "Attendance",
    icon: CalendarDays,
  },
  {
    href: "/member/contributions",
    label: "Contributions",
    icon: WalletCards,
  },
];

export default function MemberNavigation({
  variant,
}: MemberNavigationProps) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav className="flex flex-1 flex-col gap-2 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
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
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex items-center justify-center py-4 transition ${
                isActive
                  ? "text-[#203264]"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}