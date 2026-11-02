export function matchesMemberStatusFilter(memberStatus: string, filter: string) {
  return filter === "all" || memberStatus === filter;
}
