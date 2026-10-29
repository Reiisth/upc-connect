import type { MemberInactivitySummary } from "../inactivity/calculate";
import type { AnalyticsAggregates, AnalyticsBranch, AnalyticsDateRange, AnalyticsGrouping, AnalyticsMetrics, AnalyticsOverview, InactivityMetrics } from "./types";

export function summarizeInactivity(rows: readonly MemberInactivitySummary[]): InactivityMetrics {
  const calculable = rows.filter((row) => row.calculationStatus === "evaluated");
  const inactive = calculable.filter((row) => row.isInactive).length;
  return {
    monitoredMembers: rows.length, calculableMembers: calculable.length,
    derivedInactiveMembers: inactive, derivedActiveMembers: calculable.length - inactive,
    unknownMembers: rows.length - calculable.length,
    inactivePercent: calculable.length ? inactive / calculable.length * 100 : null,
    averageConsecutiveAbsentWeeks: calculable.length ? calculable.reduce((sum, row) => sum + row.consecutiveAbsentWeeks, 0) / calculable.length : null,
    oneWeekAwayMembers: calculable.filter((row) => !row.isInactive && row.remainingWeeksBeforeInactive === 1).length,
  };
}

export function emptyAnalyticsAggregates(): AnalyticsAggregates {
  return { version: 1, membership: [], membershipTrend: [], attendance: [], attendanceByType: [], attendanceTrend: [], weeklyAttendance: [],
    followUps: [], followUpByMethod: [], followUpByOutcome: [], followUpTrend: [], followUpLatest: [], followUpLatestByOutcome: [],
    contributions: [], contributionByType: [], contributionByPaymentMethod: [], contributionTrend: [], baptisms: [], baptismTrend: [] };
}

/** Assemble already aggregated database results and existing inactivity results; no source-data recalculation. */
export function assembleAnalytics(input: {
  aggregates: AnalyticsAggregates; branches: readonly AnalyticsBranch[]; inactivity: readonly MemberInactivitySummary[];
  range: AnalyticsDateRange; grouping: AnalyticsGrouping; asOfDate: string;
}): AnalyticsOverview {
  const data = input.aggregates;
  function group<T extends { branchId: string | null }>(rows: readonly T[], id: string | null): Omit<T, "branchId">[] {
    return rows.flatMap(({ branchId, ...values }) => branchId === id ? [values] : []);
  }
  function metrics(id: string | null): AnalyticsMetrics {
    const membership = group(data.membership, id)[0] ?? { nonArchivedMembers: 0, storedActiveMembers: 0, archivedMembers: 0,
      recordsAddedInRange: 0, firstAttendancesInRange: 0, missingFirstAttendanceDate: 0 };
    const membershipTrend = group(data.membershipTrend, id);
    const attendance = group(data.attendance, id)[0] ?? { completedServices: 0, physicalCheckIns: 0, uniqueMembers: 0, averagePerService: null };
    const weekly = group(data.weeklyAttendance, id);
    return {
      membership: { ...membership,
        recordCreationTrend: membershipTrend.map((point) => ({ periodStart: point.periodStart, value: point.recordsAdded })),
        firstAttendanceTrend: membershipTrend.map((point) => ({ periodStart: point.periodStart, value: point.firstAttendances })),
      },
      attendance: { ...attendance, byServiceType: group(data.attendanceByType, id), trend: group(data.attendanceTrend, id), weekly,
        eligibleCompletedServiceWeeks: weekly.filter((week) => week.isFinished && !week.isPartialRange).length },
      inactivity: summarizeInactivity(id === null ? input.inactivity : input.inactivity.filter((row) => row.branchId === id)),
      followUps: { ...group(data.followUps, id)[0] ?? { total: 0, uniqueMembers: 0 },
        ...group(data.followUpLatest, id)[0] ?? { latestMembers: 0, latestNeedsFollowUpMembers: 0, overdueLatestNextFollowUps: 0 },
        byMethod: group(data.followUpByMethod, id), byOutcome: group(data.followUpByOutcome, id),
        latestByOutcome: group(data.followUpLatestByOutcome, id), trend: group(data.followUpTrend, id) },
      contributions: { ...group(data.contributions, id)[0] ?? { count: 0, totalAmount: "0.00", averageAmount: null },
        byContributionType: group(data.contributionByType, id), byPaymentMethod: group(data.contributionByPaymentMethod, id), trend: group(data.contributionTrend, id) },
      baptisms: { ...group(data.baptisms, id)[0] ?? { total: 0, water: 0, holyGhost: 0, undatedRecords: 0 }, trend: group(data.baptismTrend, id) },
    };
  }
  return { ...metrics(null), range: input.range, grouping: input.grouping, asOfDate: input.asOfDate,
    branches: input.branches.map((branch) => {
      const values = metrics(branch.id);
      return { ...values, branch, inactivity: branch.isActive ? values.inactivity : null };
    }) };
}
