import "server-only";
import { DecisionSupportError } from "./errors";
import type { DecisionSupportDisplayEvidence, DecisionSupportEvidence, DecisionSupportInput } from "./types";

type Format = DecisionSupportDisplayEvidence["format"];
type Fields = Record<string, string | readonly [string, Format]>;
const attendance: Fields = {
  completedServices: "Completed services", physicalCheckIns: "Physical check-ins",
  uniqueMembers: "Unique attendees", averagePerService: "Average attendance per service",
};
const inactivity: Fields = {
  monitoredMembers: "Current monitored members", calculableMembers: "Members with calculable inactivity",
  derivedActiveMembers: "Currently derived active members", derivedInactiveMembers: "Currently derived inactive members",
  unknownMembers: "Members with unknown inactivity", inactivePercent: ["Current inactive percentage", "percent"],
  averageConsecutiveAbsentWeeks: "Average consecutive absent eligible weeks", oneWeekAwayMembers: "Members one eligible week from inactivity",
};
const contribution: Fields = {
  count: "Contribution count", totalAmount: ["Total contributions", "money"], averageAmount: ["Average contribution", "money"],
};
const baptism: Fields = { total: "Baptisms in period", water: "Water baptisms", holyGhost: "Holy Ghost baptisms" };
const period: Fields = { periodStart: ["Period starts", "date"] };
const readableCategory = (value: string) => value.replaceAll("_", " ");

/** Label only server-resolved citations. No model labels, arbitrary traversal, or metric calculations. */
export function labelDecisionSupportEvidence(
  evidence: readonly DecisionSupportEvidence[], input: DecisionSupportInput,
  branches: readonly { label: string; displayName: string }[],
): DecisionSupportDisplayEvidence[] {
  const labels = new Map<string, { label: string; format: Format }>();
  function add(prefix: string, fields: Fields, context = "") {
    for (const [field, descriptor] of Object.entries(fields)) {
      const [label, format] = typeof descriptor === "string" ? [descriptor, "number" as const] : descriptor;
      labels.set(`${prefix}.${field}`, { label: context ? `${context} · ${label}` : label, format });
    }
  }
  add("reportingContext", {
    "dateRange.from": ["Inclusive report start", "date"], "dateRange.to": ["Inclusive report end", "date"],
    "dateRange.timeZone": ["Report time zone", "text"], grouping: ["Trend grouping", "text"],
    asOfDate: ["Current-state reference date", "date"], "branchScope.mode": ["Branch scope", "text"], "branchScope.branchCount": "Accessible branches in report",
  });
  add("membership", { nonArchivedMembers: "Current non-archived members", recordsAddedInRange: "Member records added in period",
    missingFirstAttendanceDate: "Members missing first attendance date" });
  input.membership.recordCreationTrend.forEach((point, i) => add(`membership.recordCreationTrend.${i}`,
    { ...period, value: "Member records added" }, `Period starting ${point.periodStart}`));
  add("attendance", { ...attendance, eligibleCompletedServiceWeeks: "Eligible completed-service weeks" });
  input.attendance.byServiceType.forEach((point, i) => add(`attendance.byServiceType.${i}`,
    { ...attendance, serviceType: ["Service type", "text"] }, readableCategory(point.serviceType)));
  input.attendance.trend.forEach((point, i) => add(`attendance.trend.${i}`, { ...attendance, ...period }, `Period starting ${point.periodStart}`));
  input.attendance.weekly.forEach((point, i) => add(`attendance.weekly.${i}`, {
    weekStart: ["Week starts", "date"], uniqueMembers: "Unique attendees", isFinished: ["Finished week", "text"],
    isPartialRange: ["Partially selected week", "text"], eligibleMemberCount: "Eligible members",
    participationRatePercent: ["Participation rate", "percent"],
  }, `Week starting ${point.weekStart}`));
  add("inactivity", inactivity);
  add("followUps", {
    total: "Follow-ups in period", uniqueMembers: "Unique members followed up in period", latestMembers: "Members with a latest follow-up",
    latestNeedsFollowUpMembers: "Members currently needing follow-up", overdueLatestNextFollowUps: "Overdue latest next follow-ups",
  });
  input.followUps.byMethod.forEach((point, i) => add(`followUps.byMethod.${i}`,
    { method: ["Method", "text"], count: "Follow-ups in period" }, readableCategory(point.method)));
  for (const key of ["byOutcome", "latestByOutcome"] as const) {
    input.followUps[key].forEach((point, i) => add(`followUps.${key}.${i}`,
      { outcome: ["Outcome", "text"], count: key === "latestByOutcome" ? "Members with this latest outcome" : "Follow-ups in period" }, readableCategory(point.outcome)));
  }
  input.followUps.trend.forEach((point, i) => add(`followUps.trend.${i}`, { ...period, value: "Follow-ups" }, `Period starting ${point.periodStart}`));
  add("contributions", contribution);
  input.contributions.byContributionType.forEach((point, i) => add(`contributions.byContributionType.${i}`,
    { ...contribution, contributionType: ["Contribution type", "text"] }, readableCategory(point.contributionType)));
  input.contributions.trend.forEach((point, i) => add(`contributions.trend.${i}`, { ...contribution, ...period }, `Period starting ${point.periodStart}`));
  add("baptisms", { ...baptism, undatedRecords: "Current undated baptism records" });
  input.baptisms.trend.forEach((point, i) => add(`baptisms.trend.${i}`, { ...baptism, ...period }, `Period starting ${point.periodStart}`));
  input.branches.forEach((branch, i) => {
    const context = branches.find((item) => item.label === branch.label)?.displayName ?? branch.label;
    add(`branches.${i}`, {
      label: ["Report branch alias", "text"], isActive: ["Active branch", "text"], inactivityThresholdWeeks: "Inactivity threshold in eligible weeks",
      nonArchivedMembers: "Current non-archived members", completedServices: "Completed services", averagePerService: "Average attendance per service",
      followUpsInRange: "Follow-ups in period", latestNeedsFollowUpMembers: "Members currently needing follow-up",
      overdueLatestNextFollowUps: "Overdue latest next follow-ups", contributionTotal: ["Total contributions", "money"],
      waterBaptismsInRange: "Water baptisms in period", holyGhostBaptismsInRange: "Holy Ghost baptisms in period",
    }, context);
    if (branch.inactivity) add(`branches.${i}.inactivity`, inactivity, context);
    else labels.set(`branches.${i}.inactivity`, { label: `${context} · Current inactivity monitoring`, format: "text" });
  });
  return evidence.map((item) => {
    const descriptor = labels.get(item.path);
    if (!descriptor) throw new DecisionSupportError("INVALID_RESPONSE");
    return { ...item, ...descriptor };
  });
}
