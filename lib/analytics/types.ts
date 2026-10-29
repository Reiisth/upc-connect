export type AnalyticsGrouping = "day" | "week" | "month";
export type AnalyticsRangeInput =
  | { preset: "last_7_days" | "last_30_days" | "last_90_days" | "year_to_date" }
  | { preset: "custom"; from: string; to: string };
export type AnalyticsDateRange = { from: string; to: string; timeZone: "Asia/Manila" };
export type AnalyticsRequest = { range?: AnalyticsRangeInput; grouping?: AnalyticsGrouping; branchId?: string };
export type TimeSeriesPoint<T = number> = { periodStart: string; value: T };

export type MembershipMetrics = {
  nonArchivedMembers: number;
  storedActiveMembers: number;
  archivedMembers: number;
  /** Administrative record creation, not church membership acceptance. */
  recordsAddedInRange: number;
  firstAttendancesInRange: number;
  missingFirstAttendanceDate: number;
  recordCreationTrend: TimeSeriesPoint[];
  firstAttendanceTrend: TimeSeriesPoint[];
};
export type AttendanceCounts = {
  completedServices: number; physicalCheckIns: number; uniqueMembers: number; averagePerService: number | null;
};
export type AttendanceSeriesPoint = AttendanceCounts & { periodStart: string };
export type WeeklyAttendancePoint = AttendanceCounts & {
  weekStart: string; isFinished: boolean; isPartialRange: boolean;
  /** Historical branch eligibility rosters do not exist; no denominator is invented. */
  eligibleMemberCount: null; participationRatePercent: null;
};
export type AttendanceMetrics = AttendanceCounts & {
  byServiceType: (AttendanceCounts & { serviceType: string })[];
  trend: AttendanceSeriesPoint[];
  weekly: WeeklyAttendancePoint[];
  /** Distinct full finished calendar weeks with at least one completed service. */
  eligibleCompletedServiceWeeks: number;
};
export type InactivityMetrics = {
  monitoredMembers: number; calculableMembers: number; derivedInactiveMembers: number; derivedActiveMembers: number;
  unknownMembers: number; inactivePercent: number | null; averageConsecutiveAbsentWeeks: number | null; oneWeekAwayMembers: number;
};
export type FollowUpMetrics = {
  total: number; uniqueMembers: number;
  byMethod: { method: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  trend: TimeSeriesPoint[];
  /** Current state uses latest accessible record per member, independent of selected range. */
  latestMembers: number; latestNeedsFollowUpMembers: number; overdueLatestNextFollowUps: number;
  latestByOutcome: { outcome: string; count: number }[];
};
/** Exact decimal strings: never coerce money to binary floats. */
export type ContributionAmounts = { count: number; totalAmount: string; averageAmount: string | null };
export type ContributionMetrics = ContributionAmounts & {
  byContributionType: (ContributionAmounts & { contributionType: string })[];
  byPaymentMethod: (ContributionAmounts & { paymentMethod: string })[];
  trend: (ContributionAmounts & { periodStart: string })[];
};
export type BaptismCounts = { total: number; water: number; holyGhost: number; undatedRecords: number };
export type BaptismMetrics = BaptismCounts & {
  trend: { periodStart: string; total: number; water: number; holyGhost: number }[];
};
export type AnalyticsMetrics = {
  membership: MembershipMetrics; attendance: AttendanceMetrics; inactivity: InactivityMetrics;
  followUps: FollowUpMetrics; contributions: ContributionMetrics; baptisms: BaptismMetrics;
};
export type AnalyticsBranch = { id: string; name: string; code: string | null; isActive: boolean; inactivityThresholdWeeks: number };
export type BranchComparisonMetrics = {
  branch: AnalyticsBranch;
  membership: MembershipMetrics; attendance: AttendanceMetrics;
  /** Current inactivity monitoring is unavailable for inactive branches. */
  inactivity: InactivityMetrics | null;
  followUps: FollowUpMetrics; contributions: ContributionMetrics; baptisms: BaptismMetrics;
};
export type AnalyticsOverview = AnalyticsMetrics & {
  range: AnalyticsDateRange; grouping: AnalyticsGrouping; asOfDate: string;
  branches: BranchComparisonMetrics[];
};

// Internal aggregation RPC contract. Contains aggregates, never raw source records.
type Group<T> = T & { branchId: string | null };
export type AnalyticsAggregates = {
  version: 1;
  membership: Group<Omit<MembershipMetrics, "recordCreationTrend" | "firstAttendanceTrend">>[];
  membershipTrend: Group<{ periodStart: string; recordsAdded: number; firstAttendances: number }>[];
  attendance: Group<AttendanceCounts>[];
  attendanceByType: Group<AttendanceCounts & { serviceType: string }>[];
  attendanceTrend: Group<AttendanceSeriesPoint>[];
  weeklyAttendance: Group<WeeklyAttendancePoint>[];
  followUps: Group<{ total: number; uniqueMembers: number }>[];
  followUpByMethod: Group<{ method: string; count: number }>[];
  followUpByOutcome: Group<{ outcome: string; count: number }>[];
  followUpTrend: Group<TimeSeriesPoint>[];
  followUpLatest: Group<{ latestMembers: number; latestNeedsFollowUpMembers: number; overdueLatestNextFollowUps: number }>[];
  followUpLatestByOutcome: Group<{ outcome: string; count: number }>[];
  contributions: Group<ContributionAmounts>[];
  contributionByType: Group<ContributionAmounts & { contributionType: string }>[];
  contributionByPaymentMethod: Group<ContributionAmounts & { paymentMethod: string }>[];
  contributionTrend: Group<ContributionAmounts & { periodStart: string }>[];
  baptisms: Group<BaptismCounts>[];
  baptismTrend: Group<{ periodStart: string; total: number; water: number; holyGhost: number }>[];
};
