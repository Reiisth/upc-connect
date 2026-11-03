import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardPen,
  Droplets,
  HandCoins,
  IdCardLanyard,
  MoreHorizontal,
  Settings,
  UserRound,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import {
  hasAnyPermission,
  hasPermission,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/permissions";
import ActiveNavigationLink from "./ActiveNavigationLink";
import { PortalIdentitySummary } from "./PortalIdentitySummary";
import type { PortalUserContext } from "@/lib/portal-user-context";

type Item = {
  label: string;
  href: string;
  requiredPermission?: PermissionKey;
  canView?: (permissions: readonly PermissionKey[]) => boolean;
  icon: React.ElementType;
};
type Group = { label: string; items: Item[] };
type PortalNavigationProps = {
  permissions: readonly PermissionKey[];
  variant: "desktop" | "mobile";
  identity?: PortalUserContext;
};

const groups: Group[] = [
  { label: "Overview", items: [
    { label: "Reports & Analytics", href: "/portal/reports", icon: BarChart3, requiredPermission: "reports.view" },
  ] },
  { label: "People & Care", items: [
    { label: "Members", href: "/portal/members", icon: UsersRound, requiredPermission: "members.view" },
    { label: "Inactivity Monitoring", href: "/portal/inactivity", icon: Activity, requiredPermission: "inactivity.view" },
    { label: "Follow-ups", href: "/portal/follow-ups", icon: ClipboardPen, requiredPermission: "follow_ups.view" },
  ] },
  { label: "Services & Attendance", items: [
    { label: "Services", href: "/portal/services", icon: CalendarDays, requiredPermission: "services.view" },
    { label: "Attendance", href: "/portal/attendance", icon: ClipboardCheck, requiredPermission: "attendance.view" },
  ] },
  { label: "Church Records", items: [
    { label: "Baptisms", href: "/portal/baptisms", icon: Droplets, requiredPermission: "baptisms.view" },
    { label: "Contributions", href: "/portal/contributions", icon: HandCoins, requiredPermission: "contributions.view" },
  ] },
  { label: "Management", items: [
    { label: "Accounts", href: "/portal/accounts", icon: UserRoundCog,
      canView: (permissions) => hasAnyPermission(permissions, ["accounts.view", "accounts.manage_branch_access"]) },
    { label: "Administration", href: "/portal/administration", icon: Settings,
      canView: (permissions) => hasAnyPermission(permissions, ["administration.view", "branches.view", "roles.view", "departments.view", "departments.manage", "accounts.manage_branch_access"]) },
  ] },
  { label: "Personal", items: [
    { label: "My Profiles", href: "/portal/profile", icon: IdCardLanyard, requiredPermission: "profile.view" },
    { label: "My Account", href: "/portal/account", icon: UserRound,
      canView: (permissions) => hasAnyPermission(permissions, PERMISSION_KEYS) },
  ] },
];

const operationalGroupLabels = new Set([
  "People & Care", "Services & Attendance", "Church Records",
]);

function itemIsVisible(item: Item, permissions: readonly PermissionKey[]) {
  return item.requiredPermission
    ? hasPermission(permissions, item.requiredPermission)
    : item.canView?.(permissions) ?? false;
}

function NavigationLink({ item, mobile = false }: { item: Item; mobile?: boolean }) {
  const Icon = item.icon;
  return (
    <ActiveNavigationLink
      href={item.href}
      className={mobile
        ? "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition"
        : "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition"}
      activeClassName="bg-[#EEF3FB] text-[#203264]"
      inactiveClassName="text-muted-foreground hover:bg-[#EEF3FB] hover:text-[#203264]"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className={mobile ? "max-w-full truncate" : undefined}>{item.label}</span>
    </ActiveNavigationLink>
  );
}

export default function PortalNavigation({ permissions, variant, identity }: PortalNavigationProps) {
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemIsVisible(item, permissions)).map((item) =>
      item.label === "Accounts" && !hasPermission(permissions, "accounts.view")
        ? { ...item, href: "/portal/accounts/staff" }
        : item,
    ),
  })).filter((group) => group.items.length > 0);

  if (variant === "mobile") {
    const overview = visibleGroups.find((group) => group.label === "Overview")?.items ?? [];
    const primary = visibleGroups.filter((group) => operationalGroupLabels.has(group.label))
      .flatMap((group) => group.items).slice(0, 2);
    const primaryHrefs = new Set([...overview, ...primary].map((item) => item.href));
    const moreGroups = visibleGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !primaryHrefs.has(item.href)),
    })).filter((group) => group.items.length > 0);

    return (
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-50 border-t bg-white md:hidden">
        <div className="flex items-stretch gap-1 px-2 py-2">
          {overview.map((item) => <NavigationLink key={item.href} item={item} mobile />)}
          {primary.map((item) => <NavigationLink key={item.href} item={item} mobile />)}
          <details className="group relative min-w-0 flex-1">
            <summary className="flex h-full cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-muted-foreground hover:bg-[#F8FAFD] hover:text-[#203264] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8]">
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span>More</span>
            </summary>
            <div className="absolute bottom-full right-0 mb-2 max-h-[70vh] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl">
              {identity && <div className="mb-3"><PortalIdentitySummary context={identity} /></div>}
              {moreGroups.map((group) => (
                <section key={group.label} className="mb-3 last:mb-0">
                  <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</h2>
                  <div className="space-y-1">
                    {group.items.map((item) => <NavigationLink key={item.href} item={item} />)}
                  </div>
                </section>
              ))}
            </div>
          </details>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Primary navigation" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</h2>
          <div className="space-y-1">
            {group.items.map((item) => <NavigationLink key={item.href} item={item} />)}
          </div>
        </section>
      ))}
    </nav>
  );
}
