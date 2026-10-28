export const FOLLOW_UP_METHODS = ["call", "message", "visit", "in_person", "other"] as const;
export const FOLLOW_UP_OUTCOMES = ["contacted", "no_response", "needs_follow_up", "resolved"] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number];
export const METHOD_LABELS: Record<FollowUpMethod, string> = {
  call: "Call", message: "Message", visit: "Visit", in_person: "In Person", other: "Other",
};
export const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  contacted: "Contacted", no_response: "No Response", needs_follow_up: "Needs Follow-up", resolved: "Resolved",
};
export type FollowUpBranch = { id: string; name: string; code: string | null; isActive: boolean };
export type FollowUpMember = { id: string; name: string; branchId: string | null; isArchived: boolean };
export type FollowUpPerformer = { id: string; name: string };
export type FollowUpRecord = {
  id: string; memberId: string; memberName: string; branchId: string; branchName: string; branchIsActive: boolean;
  followUpDate: string; method: FollowUpMethod; outcome: FollowUpOutcome;
  followedUpBy: string | null; performerName: string | null; notes: string | null;
  nextFollowUpDate: string | null; createdBy: string | null;
};
export type FollowUpValues = {
  branchId: string; memberId: string; followUpDate: string; method: FollowUpMethod; outcome: FollowUpOutcome;
  followedUpBy: string; notes: string; nextFollowUpDate: string;
};
export type FollowUpActionState = { error: string | null };
export type FollowUpAction = (state: FollowUpActionState, form: FormData) => Promise<FollowUpActionState>;
export type DueFilter = "all" | "overdue" | "today" | "upcoming";

export function getDueStatus(nextDate: string | null, today: string): Exclude<DueFilter, "all"> | null {
  if (!nextDate) return null;
  return nextDate < today ? "overdue" : nextDate === today ? "today" : "upcoming";
}

export function filterFollowUps(rows: readonly FollowUpRecord[], filters: {
  search: string; branch: string; method: string; outcome: string; dateFrom: string; dateTo: string; due: DueFilter;
}, today: string) {
  const search = filters.search.trim().toLocaleLowerCase("en-PH");
  return rows.filter((row) =>
    row.memberName.toLocaleLowerCase("en-PH").includes(search) &&
    (!filters.branch || row.branchId === filters.branch) &&
    (!filters.method || row.method === filters.method) &&
    (!filters.outcome || row.outcome === filters.outcome) &&
    (!filters.dateFrom || row.followUpDate >= filters.dateFrom) &&
    (!filters.dateTo || row.followUpDate <= filters.dateTo) &&
    (filters.due === "all" || getDueStatus(row.nextFollowUpDate, today) === filters.due),
  );
}

export function memberName(member: { first_name: string | null; middle_name: string | null; last_name: string | null }) {
  return [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ").trim() || "Unnamed member";
}

export function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
