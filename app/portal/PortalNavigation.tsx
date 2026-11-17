import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardPen,
  Droplets,
  HandCoins,
  IdCardLanyard,
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
import MobileNavigation from "./MobileNavigation";

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
      canView: (permissions) => hasAnyPermission(permissions, ["administration.view", "branches.view", "roles.view", "departments.view", "departments.manage", "service_types.view", "service_types.manage"]) },
  ] },
  { label: "Personal", items: [
    { label: "My Profiles", href: "/portal/profile", icon: IdCardLanyard, requiredPermission: "profile.view" },
    { label: "My Account", href: "/portal/account", icon: UserRound,
      canView: (permissions) => hasAnyPermission(permissions, PERMISSION_KEYS) },
  ] },
];

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
      label={item.label}
      className={mobile
        ? "portal-nav-link flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#365FA6]"
        : "portal-nav-link flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#365FA6]"}
      activeClassName="bg-[#EEF3FB] text-[#203264]"
      inactiveClassName="text-muted-foreground hover:bg-[#EEF3FB] hover:text-[#203264]"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className={mobile ? "max-w-full break-words text-center leading-tight" : "portal-nav-label"}>{mobile ? ({ "Reports & Analytics": "Reports", "Inactivity Monitoring": "Inactivity", "My Profiles": "Profiles", "My Account": "Account" }[item.label] ?? item.label) : item.label}</span>
    </ActiveNavigationLink>
  );
}

export function getPortalNavigationRoutes(permissions: readonly PermissionKey[]) {
  return groups.flatMap(group => group.items).filter(item => itemIsVisible(item, permissions)).map(item =>
    item.label === "Accounts" ? hasPermission(permissions, "accounts.view") ? "/portal/accounts/members" : "/portal/accounts/staff" : item.href);
}

export default function PortalNavigation({ permissions, variant }: PortalNavigationProps) {
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemIsVisible(item, permissions)).map((item) =>
      item.label === "Accounts"
        ? { ...item, href: hasPermission(permissions, "accounts.view") ? "/portal/accounts/members" : "/portal/accounts/staff" }
        : item,
    ),
  })).filter((group) => group.items.length > 0);

  if (variant === "mobile") {
    const items = visibleGroups.flatMap((group) => group.items);
    if (!items.length) return null;
    const priority = ["/portal/members", "/portal/attendance", "/portal/services", "/portal/reports", "/portal/profile"];
    const primary = items.length <= 4 ? items : [...items].sort((a, b) => {
      const rank = (href: string) => priority.includes(href) ? priority.indexOf(href) : priority.length;
      return rank(a.href) - rank(b.href);
    }).slice(0, 3);
    const primaryHrefs = new Set(primary.map((item) => item.href));
    const moreGroups = visibleGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !primaryHrefs.has(item.href)),
    })).filter((group) => group.items.length > 0);

    return (
      <MobileNavigation primary={primary.map((item) => <NavigationLink key={item.href} item={item} mobile />)} moreRoutes={moreGroups.flatMap(group => group.items.map(item => item.href))}>
              {moreGroups.map((group) => (
                <section key={group.label} className="mb-3 last:mb-0">
                  <h3 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</h3>
                  <div className="space-y-1">
                    {group.items.map((item) => <NavigationLink key={item.href} item={item} />)}
                  </div>
                </section>
              ))}
      </MobileNavigation>
    );
  }

  return (
    <nav aria-label="Primary navigation" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {visibleGroups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="portal-nav-group-title px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</h2>
          <div className="space-y-1">
            {group.items.map((item) => <NavigationLink key={item.href} item={item} />)}
          </div>
        </section>
      ))}
    </nav>
  );
}
