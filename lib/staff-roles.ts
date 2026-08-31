export const STAFF_ROLES = [
  "system_admin",
  "pastor",
  "accounting_officer",
  "evangelism_officer",
  "spiritual_ministry_officer",
  "usher",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PORTAL_PATHS: Record<StaffRole, string> = {
  system_admin: "/staff/admin",
  pastor: "/staff/pastor",
  accounting_officer: "/staff/finance",
  evangelism_officer: "/staff/evangelism",
  spiritual_ministry_officer: "/staff/spiritual-ministry",
  usher: "/staff/usher",
};

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function getStaffPortalPath(role: StaffRole): string {
  return STAFF_PORTAL_PATHS[role];
}
