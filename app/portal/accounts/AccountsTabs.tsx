"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";

const tabs = [
  {
    label: "Member Accounts",
    href: "/portal/accounts/members",
    icon: Users,
  },
  {
    label: "Staff Accounts",
    href: "/portal/accounts/staff",
    icon: ShieldCheck,
  },
];

export default function AccountsTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {tabs.map((tab) => {
        const Icon = tab.icon;

        const active =
          pathname === tab.href ||
          pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2
              dark:focus-visible:ring-offset-slate-900
              ${
                active
                  ? "bg-brand-gradient text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#EEF3FB] hover:text-[#203264] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }
            `}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}