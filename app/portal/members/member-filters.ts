export function matchesMemberColumnFilter(value: string, filter: string) {
  return filter === "all" || value === filter;
}
