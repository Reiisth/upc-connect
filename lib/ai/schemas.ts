import "server-only";
import { z } from "zod";
import { validAnalyticsDate } from "@/lib/analytics/date-range";
import { FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES } from "@/app/portal/follow-ups/types";
import { CONTRIBUTION_TYPES } from "@/app/portal/contributions/types";

const date = z.string().refine(validAnalyticsDate);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const average = z.number().nonnegative().nullable();
const percent = z.number().min(0).max(100).nullable();
const money = z.string().regex(/^\d+\.\d{2}$/).max(100);
const grouping = z.enum(["day", "week", "month"]);
const countTrend = z.array(z.strictObject({ periodStart: date, value: count }));
const attendanceCounts = z.strictObject({ completedServices: count, physicalCheckIns: count, uniqueMembers: count, averagePerService: average });
const inactivity = z.strictObject({
  monitoredMembers: count, calculableMembers: count, monitoringMembers: count, needsFollowUpMembers: count,
  unknownMembers: count, needsFollowUpPercent: percent, averageConsecutiveAbsentWeeks: average, approachingFollowUpThreshold: count,
});
const contributionAmounts = z.strictObject({ count, totalAmount: money, averageAmount: money.nullable() });
const outcomeCounts = z.array(z.strictObject({ outcome: z.enum(FOLLOW_UP_OUTCOMES), count }));

/** Filters only. Unknown keys (including posted analytics, prompts or model settings) are rejected. */
export const decisionSupportFiltersSchema = z.strictObject({
  branchId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).toLowerCase().optional(),
  grouping: grouping.optional(),
  range: z.discriminatedUnion("preset", [
    z.strictObject({ preset: z.enum(["last_7_days", "last_30_days", "last_90_days", "year_to_date"]) }),
    z.strictObject({ preset: z.literal("custom"), from: date, to: date }),
  ]).optional(),
});

/** Reduced aggregate-only contract. No free-text operational fields or branch names. */
export const decisionSupportInputSchema = z.strictObject({
  reportingContext: z.strictObject({
    dateRange: z.strictObject({ from: date, to: date, timeZone: z.literal("Asia/Manila") }),
    grouping, asOfDate: date,
    branchScope: z.strictObject({ mode: z.enum(["one_accessible_branch", "all_accessible_branches"]), branchCount: count }),
  }),
  membership: z.strictObject({ nonArchivedMembers: count, recordsAddedInRange: count, missingFirstAttendanceDate: count, recordCreationTrend: countTrend }),
  attendance: attendanceCounts.extend({
    byServiceType: z.array(attendanceCounts.extend({ serviceType: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/) })),
    trend: z.array(attendanceCounts.extend({ periodStart: date })),
    eligibleCompletedServiceWeeks: count,
    weekly: z.array(z.strictObject({ weekStart: date, uniqueMembers: count, isFinished: z.boolean(), isPartialRange: z.boolean(),
      eligibleMemberCount: z.null(), participationRatePercent: z.null() })),
  }),
  inactivity,
  followUps: z.strictObject({
    total: count, uniqueMembers: count, latestMembers: count, latestNeedsFollowUpMembers: count, overdueLatestNextFollowUps: count,
    byMethod: z.array(z.strictObject({ method: z.enum(FOLLOW_UP_METHODS), count })),
    byOutcome: outcomeCounts, latestByOutcome: outcomeCounts, trend: countTrend,
  }),
  contributions: contributionAmounts.extend({
    byContributionType: z.array(contributionAmounts.extend({ contributionType: z.enum(CONTRIBUTION_TYPES) })),
    trend: z.array(contributionAmounts.extend({ periodStart: date })),
  }),
  baptisms: z.strictObject({
    total: count, water: count, holyGhost: count, undatedRecords: count,
    trend: z.array(z.strictObject({ periodStart: date, total: count, water: count, holyGhost: count })),
  }),
  branches: z.array(z.strictObject({
    label: z.string().regex(/^Branch [1-9]\d*$/), isActive: z.boolean(), inactivityThresholdWeeks: count.min(1),
    nonArchivedMembers: count, completedServices: count, averagePerService: average, inactivity: inactivity.nullable(),
    followUpsInRange: count, latestNeedsFollowUpMembers: count, overdueLatestNextFollowUps: count,
    contributionTotal: money, waterBaptismsInRange: count, holyGhostBaptismsInRange: count,
  })),
});

const text = (max: number) => z.string().trim().min(1).max(max);
const evidence = z.array(text(200)).min(1).max(4).describe("Exact dot paths to supplied aggregate scalar values, e.g. followUps.overdueLatestNextFollowUps; not invented prose.");
export const decisionSupportInsightSchema = z.strictObject({
  executiveSummary: text(1200).describe("Lead with the main supported implication for church care or planning and what needs human attention; use a few relevant supplied facts rather than reciting all totals."),
  keyFindings: z.array(z.strictObject({ title: text(100).describe("A clear takeaway, not merely a metric name."), observation: text(600).describe("Explain the cited pattern, why it matters for a concrete church responsibility, and a relevant uncertainty or question to verify. Separate interpretation from established fact."), evidence, severity: z.enum(["info", "attention", "important"]) })).max(5),
  recommendations: z.array(z.strictObject({ title: text(100), recommendation: text(500).describe("A specific optional human review motivated by a key insight; do not claim an action has been taken."), rationale: text(500).describe("Explain why the cited evidence makes the review useful and what staff should verify before deciding."), evidence, priority: z.enum(["low", "medium", "high"]) })).max(4),
  limitations: z.array(text(350)).min(1).max(6),
});
// The same schema drives provider JSON output and local validation. Length limits are enforced locally too.
export const decisionSupportJsonSchema = z.toJSONSchema(decisionSupportInsightSchema, { target: "draft-07" });
