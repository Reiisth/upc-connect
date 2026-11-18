export const PORTAL_BRANCH_COOKIE = "upc-portal-branch";
export type PortalBranchOption = { id: string; name: string; isActive: boolean };

export function resolvePortalBranch(cookie: string | undefined, userId: string, branches: readonly PortalBranchOption[]) {
  try {
    const saved = JSON.parse(cookie ?? "null");
    return saved?.userId === userId && typeof saved.branchId === "string" && branches.some(branch => branch.id === saved.branchId) ? saved.branchId as string : null;
  } catch { return null; }
}

export function portalBranchSwitchUrl(href: string) {
  const url = new URL(href,"http://portal.invalid");
  for (const key of ["branch","page","view.page","view.currentPage","view.branchFilter"]) url.searchParams.delete(key);
  const filters = url.searchParams.get("view.filters");
  if (filters) {
    try { const value=JSON.parse(filters);if(value && typeof value === "object") {value.branch="";url.searchParams.set("view.filters",JSON.stringify(value));} } catch { url.searchParams.delete("view.filters"); }
  }
  // Old return paths must not restore a conflicting branch or page after switching.
  url.searchParams.delete("returnTo");
  return url.pathname+url.search;
}

export function portalPageName(pathname: string) {
  const names: Record<string,string> = {reports:"Dashboard",services:"Services",attendance:"Attendance",members:"Members",inactivity:"Inactivity Monitoring","follow-ups":"Follow-ups",contributions:"Contributions",baptisms:"Baptisms",accounts:"Accounts",administration:"Administration",profile:"My Profiles",account:"My Account"};
  return names[pathname.split("/")[2]] ?? "UPC Connect";
}
