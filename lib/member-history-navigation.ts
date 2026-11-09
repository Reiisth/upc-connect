/** Only known portal entry points can become a history page's return link. */
export function memberHistoryNavigation(memberId: string, returnTo: unknown, fallbackHref: string, fallbackLabel: string) {
  const destinations: Record<string, string> = {
    [`/portal/members/${memberId}`]: "Back to Member",
    "/portal/attendance": "Back to Attendance",
    "/portal/contributions": "Back to Contributions",
    "/portal/baptisms": "Back to Baptisms",
    "/portal/follow-ups": "Back to Follow-ups",
    "/portal/inactivity": "Back to Inactivity Monitoring",
  };
  const servicePage = typeof returnTo === "string" && /^\/portal\/attendance\/[a-zA-Z0-9-]+$/.test(returnTo);
  const valid = typeof returnTo === "string" && (Object.hasOwn(destinations, returnTo) || servicePage);
  const backHref = valid ? returnTo as string : fallbackHref;
  return {
    backHref,
    backLabel: valid ? destinations[backHref] ?? "Back to Service Attendance" : fallbackLabel,
    pageHref: (page: number) => `?${new URLSearchParams({ page: String(page), ...(valid ? { returnTo: backHref } : {}) })}`,
  };
}
