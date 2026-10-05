export const portalTabs = {
  dashboard: [
    "system_admin",
    "pastor",
    "accounting_officer",
    "evangelism_officer",
    "spiritual_ministry_officer",
    "usher",
  ],

  members: [
    "system_admin",
    "pastor",
    "evangelism_officer",
    "spiritual_ministry_officer",
  ],

  attendance: [
    "usher",
    "pastor",
  ],

  contributions: [
    "accounting_officer",
    "pastor",
  ],

  baptisms: [
    "spiritual_ministry_officer",
    "pastor",
  ],

  reports: [
    "system_admin",
    "pastor",
  ],

  administration: [
    "system_admin",
  ],

  profile: [
    "member",
  ],

  accounts: [
    "system_admin",
  ],

  account: [
    "system_admin",
    "pastor",
    "accounting_officer",
    "evangelism_officer",
    "spiritual_ministry_officer",
    "usher",
    "member",
  ],

  field_management: [
    "system_admin",
  ],
} as const;

export const memberAccess = {
  manage: [
    "system_admin",
  ],

  view: [
    "system_admin",
    "pastor",
    "evangelism_officer",
    "spiritual_ministry_officer",
  ],
} as const;

export type MemberAccessLevel = "view" | "manage";

export function getMemberAccess(
  roles: string[],
): MemberAccessLevel | null {
  const canManage = memberAccess.manage.some((role) =>
    roles.includes(role),
  );

  if (canManage) {
    return "manage";
  }

  const canView = memberAccess.view.some((role) =>
    roles.includes(role),
  );

  if (canView) {
    return "view";
  }

  return null;
}

export type PortalTab = keyof typeof portalTabs;

export function canAccessTab(
  roles: string[],
  tab: PortalTab,
) {
  return portalTabs[tab].some((role) =>
    roles.includes(role),
  );
}