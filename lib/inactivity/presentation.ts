import type { MemberInactivitySummary } from "./calculate";

export type InactivityMemberRow = MemberInactivitySummary & { memberName: string; memberStatus: string | null };

export type InactivityBranch = {
  id: string;
  name: string;
  code: string | null;
  inactivityThresholdWeeks: number;
};

export type AttendanceFlag = "monitoring" | "needs_follow_up" | "unknown";

export function getAttendanceFlag(row: MemberInactivitySummary): AttendanceFlag {
  if (row.calculationStatus === "eligibility_unknown") return "unknown";
  return row.needsFollowUp ? "needs_follow_up" : "monitoring";
}

export function getMonitoringCounts(rows: readonly MemberInactivitySummary[]) {
  const counts = { total: rows.length, monitoring: 0, needsFollowUp: 0, unknown: 0 };
  for (const row of rows) {
    const flag = getAttendanceFlag(row);
    counts[flag === "needs_follow_up" ? "needsFollowUp" : flag]++;
  }
  return counts;
}

/** Presentation only: use the calculated attendance flag and streak without deriving them again. */
export function filterInactivityRows(
  rows: readonly InactivityMemberRow[],
  filters: { search: string; status: AttendanceFlag | "all"; minimumAbsences: number },
): InactivityMemberRow[] {
  const search = filters.search.trim().toLocaleLowerCase("en-PH");
  const priority = { needs_follow_up: 0, monitoring: 1, unknown: 2 };
  return rows.filter((row) =>
    row.memberName.toLocaleLowerCase("en-PH").includes(search) &&
    (filters.status === "all" || getAttendanceFlag(row) === filters.status) &&
    (filters.minimumAbsences <= 0 ||
      (row.consecutiveAbsentWeeks !== null && row.consecutiveAbsentWeeks >= filters.minimumAbsences)),
  ).sort((a, b) =>
    priority[getAttendanceFlag(a)] - priority[getAttendanceFlag(b)] ||
    (b.consecutiveAbsentWeeks ?? -1) - (a.consecutiveAbsentWeeks ?? -1) ||
    a.memberName.localeCompare(b.memberName, "en-PH") || a.memberId.localeCompare(b.memberId),
  );
}

export function formatRecentRate(row: MemberInactivitySummary): string {
  return row.recentAttendanceRate === null ? "—" :
    `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(row.recentAttendanceRate)}% (${row.recentAttendedWeeks}/${row.recentEligibleWeeks} weeks)`;
}

export function formatAttendanceDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
