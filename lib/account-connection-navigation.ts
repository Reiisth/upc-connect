/** Restrict return navigation to the actual account-connection entry pages. */
export function accountConnectionNavigation(returnTo: unknown) {
  if (typeof returnTo !== "string" || !returnTo.startsWith("/portal/") || /[\\\r\n]/.test(returnTo)) {
    return { backHref: "/portal/members", backLabel: "Back to Members" };
  }
  const url = new URL(returnTo, "http://portal.invalid");
  const labels: Record<string, string> = {
    "/portal/members": "Back to Members",
    "/portal/accounts/members": "Back to Member Accounts",
  };
  const label = labels[url.pathname]
    ?? (/^\/portal\/members\/[a-zA-Z0-9-]+$/.test(url.pathname) && url.pathname !== "/portal/members/invite" ? "Back to Member" : undefined)
    ?? (/^\/portal\/accounts\/[a-zA-Z0-9-]+$/.test(url.pathname) ? "Back to Account" : undefined);
  return label ? { backHref: url.pathname + url.search, backLabel: label }
    : { backHref: "/portal/members", backLabel: "Back to Members" };
}
