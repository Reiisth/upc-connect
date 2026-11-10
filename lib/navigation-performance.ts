export function portalFreshness(pathname: string): number {
  if (/^\/portal\/administration(?:\/|$)/.test(pathname)) return 300_000;
  if (/^\/portal\/(members|profile|account)(?:\/|$)/.test(pathname)) return 120_000;
  return 30_000;
}
export function permitBackgroundPrefetch(connection?: {saveData?: boolean; effectiveType?: string}) {
  return !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
}
export function initialPortalPrefetch(routes: readonly string[], current: string) {
  return ["/portal/account", "/portal/profile", "/portal/members", "/portal/services"]
    .filter(route => routes.includes(route) && route !== current).slice(0, 2);
}
