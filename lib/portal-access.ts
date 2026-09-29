export const portalTabs = {
  dashboard: [
    "system_admin",
    "pastor",
    "accounting_officer",
    "evangelism_officer",
    "spiritual_ministry_officer",
    "usher",
    "member",
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
    "member",
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

  field_management: [
    "system_admin",
  ],
} as const;

export type PortalTab = keyof typeof portalTabs;

export function canAccessTab(
  roles: string[],
  tab: PortalTab,
) {
  return portalTabs[tab].some((role) =>
    roles.includes(role),
  );
}