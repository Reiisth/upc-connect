import type { MemberInactivitySummary } from "./calculate";

export type InactivityMemberRow = MemberInactivitySummary & { memberName: string };

export type InactivityBranch = {
  id: string;
  name: string;
  code: string | null;
  inactivityThresholdWeeks: number;
};

export type DerivedInactivityStatus = "active" | "inactive" | "unknown";

export function getDerivedStatus(row: MemberInactivitySummary): DerivedInactivityStatus {
  if (row.calculationStatus === "eligibility_unknown") return "unknown";
  return row.isInactive ? "inactive" : "active";
}

export function getMonitoringCounts(rows: readonly MemberInactivitySummary[]) {
  const counts = { total: rows.length, active: 0, inactive: 0, unknown: 0 };
  for (const row of rows) counts[getDerivedStatus(row)]++;
  return counts;
}

/** Presentation only: use the calculated status and streak without deriving them again. */
export function filterInactivityRows(
  rows: readonly InactivityMemberRow[],
  filters: { search: string; status: DerivedInactivityStatus | "all"; minimumAbsences: number },
): InactivityMemberRow[] {
  const search = filters.search.trim().toLocaleLowerCase("en-PH");
  const priority = { inactive: 0, active: 1, unknown: 2 };
  return rows.filter((row) =>
    row.memberName.toLocaleLowerCase("en-PH").includes(search) &&
    (filters.status === "all" || getDerivedStatus(row) === filters.status) &&
    (filters.minimumAbsences <= 0 ||
      (row.consecutiveAbsentWeeks !== null && row.consecutiveAbsentWeeks >= filters.minimumAbsences)),
  ).sort((a, b) =>
    priority[getDerivedStatus(a)] - priority[getDerivedStatus(b)] ||
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
