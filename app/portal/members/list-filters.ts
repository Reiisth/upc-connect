export type MemberListFilters = {search: string; branch: string; archive: string; status: string; account: string; profile: string; sort: string; page: number};
export type MemberListSearch = Record<string, string | string[] | undefined>;
export function parseMemberListFilters(params: MemberListSearch = {}): MemberListFilters {
  const text = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const choice = (key: string, allowed: string[], fallback: string) => allowed.includes(text(key)) ? text(key) : fallback;
  const page = Number(text("page") || 1);
  return {search: text("search").slice(0,100), branch: text("branch") || "all",
    archive: choice("archive", ["active","archived","all"], "active"), status: choice("status",["active","inactive","all"],"all"),
    account: choice("account",["connected","invited","no_account","all"],"all"), profile: choice("profile",["completed","incomplete","all"],"all"),
    sort: choice("sort",["newest","oldest","name_asc","name_desc","active_first","inactive_first"],"newest"),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page,100000) : 1};
}
export function memberListUrl(filters: MemberListFilters) {
  const defaults = parseMemberListFilters(); const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof MemberListFilters)[]) if (filters[key] !== defaults[key]) params.set(key,String(filters[key]));
  return "/portal/members" + (params.size ? "?"+params.toString() : "");
}
export function memberSearchWords(search: string) { return search.replace(/[^\p{L}\p{N}\s@.-]/gu," ").trim().split(/\s+/).filter(Boolean).slice(0,8); }
