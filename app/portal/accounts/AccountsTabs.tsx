"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ShieldCheck } from "lucide-react";

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
    <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;

        const active =
          pathname === tab.href ||
          pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-[#203264] text-white"
                : "text-slate-600 hover:bg-[#EEF3FB] hover:text-[#203264]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}