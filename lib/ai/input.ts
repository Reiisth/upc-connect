import "server-only";
import { Buffer } from "node:buffer";
import type { AnalyticsOverview, AttendanceCounts, InactivityMetrics } from "@/lib/analytics/types";
import { DECISION_SUPPORT_MAX_INPUT_BYTES } from "./config";
import { DecisionSupportError } from "./errors";
import { decisionSupportInputSchema } from "./schemas";
import type { DecisionSupportEvidence, DecisionSupportInput, DecisionSupportScopeMode } from "./types";

function attendanceCounts(value: AttendanceCounts) {
  return { completedServices: value.completedServices, physicalCheckIns: value.physicalCheckIns, uniqueMembers: value.uniqueMembers, averagePerService: value.averagePerService };
}
function inactivityCounts(value: InactivityMetrics) {
  return { monitoredMembers: value.monitoredMembers, calculableMembers: value.calculableMembers,
    derivedActiveMembers: value.derivedActiveMembers, derivedInactiveMembers: value.derivedInactiveMembers,
    unknownMembers: value.unknownMembers, inactivePercent: value.inactivePercent,
    averageConsecutiveAbsentWeeks: value.averageConsecutiveAbsentWeeks, oneWeekAwayMembers: value.oneWeekAwayMembers };
}

/** Explicit nested allowlist: never spread source DTOs, branch metadata, or operational records. */
export function buildDecisionSupportInput(data: AnalyticsOverview, mode: DecisionSupportScopeMode): DecisionSupportInput {
  const { membership: m, attendance: a, followUps: f, contributions: c, baptisms: b } = data;
  const payload = {
    reportingContext: { dateRange: { from: data.range.from, to: data.range.to, timeZone: data.range.timeZone },
      grouping: data.grouping, asOfDate: data.asOfDate, branchScope: { mode, branchCount: data.branches.length } },
    membership: { nonArchivedMembers: m.nonArchivedMembers, recordsAddedInRange: m.recordsAddedInRange,
      missingFirstAttendanceDate: m.missingFirstAttendanceDate,
      recordCreationTrend: m.recordCreationTrend.map((point) => ({ periodStart: point.periodStart, value: point.value })) },
    attendance: { ...attendanceCounts(a),
      byServiceType: a.byServiceType.map((point) => ({ ...attendanceCounts(point), serviceType: point.serviceType })),
      trend: a.trend.map((point) => ({ ...attendanceCounts(point), periodStart: point.periodStart })),
      eligibleCompletedServiceWeeks: a.eligibleCompletedServiceWeeks,
      weekly: a.weekly.map((point) => ({ weekStart: point.weekStart, uniqueMembers: point.uniqueMembers,
        isFinished: point.isFinished, isPartialRange: point.isPartialRange,
        eligibleMemberCount: point.eligibleMemberCount, participationRatePercent: point.participationRatePercent })) },
    inactivity: inactivityCounts(data.inactivity),
    followUps: { total: f.total, uniqueMembers: f.uniqueMembers, latestMembers: f.latestMembers,
      latestNeedsFollowUpMembers: f.latestNeedsFollowUpMembers, overdueLatestNextFollowUps: f.overdueLatestNextFollowUps,
      byMethod: f.byMethod.map((point) => ({ method: point.method, count: point.count })),
      byOutcome: f.byOutcome.map((point) => ({ outcome: point.outcome, count: point.count })),
      latestByOutcome: f.latestByOutcome.map((point) => ({ outcome: point.outcome, count: point.count })),
      trend: f.trend.map((point) => ({ periodStart: point.periodStart, value: point.value })) },
    contributions: { totalAmount: c.totalAmount, count: c.count, averageAmount: c.averageAmount,
      byContributionType: c.byContributionType.map((point) => ({ contributionType: point.contributionType, count: point.count, totalAmount: point.totalAmount, averageAmount: point.averageAmount })),
      trend: c.trend.map((point) => ({ periodStart: point.periodStart, count: point.count, totalAmount: point.totalAmount, averageAmount: point.averageAmount })) },
    baptisms: { total: b.total, water: b.water, holyGhost: b.holyGhost, undatedRecords: b.undatedRecords,
      trend: b.trend.map((point) => ({ periodStart: point.periodStart, total: point.total, water: point.water, holyGhost: point.holyGhost })) },
    branches: data.branches.map((row, index) => ({ label: `Branch ${index + 1}`, isActive: row.branch.isActive,
      inactivityThresholdWeeks: row.branch.inactivityThresholdWeeks, nonArchivedMembers: row.membership.nonArchivedMembers,
      completedServices: row.attendance.completedServices, averagePerService: row.attendance.averagePerService,
      inactivity: row.inactivity ? inactivityCounts(row.inactivity) : null,
      followUpsInRange: row.followUps.total, latestNeedsFollowUpMembers: row.followUps.latestNeedsFollowUpMembers,
      overdueLatestNextFollowUps: row.followUps.overdueLatestNextFollowUps,
      contributionTotal: row.contributions.totalAmount, waterBaptismsInRange: row.baptisms.water, holyGhostBaptismsInRange: row.baptisms.holyGhost })),
  };
  const parsed = decisionSupportInputSchema.safeParse(payload);
  if (!parsed.success) throw new DecisionSupportError("ANALYTICS_UNAVAILABLE");
  if (Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > DECISION_SUPPORT_MAX_INPUT_BYTES) throw new DecisionSupportError("PAYLOAD_TOO_LARGE");
  return parsed.data;
}

/** Scalar lookup only; model-provided paths are never evaluated as object traversal/code. */
export function decisionSupportEvidenceIndex(input: DecisionSupportInput): Map<string, DecisionSupportEvidence["value"]> {
  const index = new Map<string, DecisionSupportEvidence["value"]>();
  function visit(value: unknown, path: string) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") index.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}.${i}`));
    else if (typeof value === "object") for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key);
  }
  visit(input, "");
  return index;
}
