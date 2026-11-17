/** Only known portal entry points can become a history page's return link. */
export function memberHistoryNavigation(memberId: string, returnTo: unknown, fallbackHref: string, fallbackLabel: string) {
  const destinations: Record<string, string> = {
    "/portal/members": "Back to Members",
    "/portal/members/migrations": "Back to Migration Records",
    [`/portal/members/${memberId}`]: "Back to Member",
    [`/portal/follow-ups/member/${memberId}`]: "Back to Follow-up History",
    "/portal/attendance": "Back to Attendance",
    "/portal/contributions": "Back to Contributions",
    "/portal/baptisms": "Back to Baptisms",
    "/portal/follow-ups": "Back to Follow-ups",
    "/portal/inactivity": "Back to Inactivity Monitoring",
  };
  // Validate the literal pathname before URL normalization; retain the source's filters.
  const safe = typeof returnTo === "string" && returnTo.startsWith("/portal/") && !/[\\\r\n#]/.test(returnTo) && returnTo.length <= 8000;
  const path = safe ? returnTo.split("?")[0] : "";
  const servicePage = /^\/portal\/attendance\/[a-zA-Z0-9-]+$/.test(path);
  const valid = safe && (Object.hasOwn(destinations, path) || servicePage);
  const backHref = valid ? returnTo as string : fallbackHref;
  return {
    backHref,
    backLabel: valid ? destinations[path] ?? "Back to Service Attendance" : fallbackLabel,
    pageHref: (page: number) => `?${new URLSearchParams({ page: String(page), ...(valid ? { returnTo: backHref } : {}) })}`,
  };
}
