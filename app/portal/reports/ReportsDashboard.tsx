import type { ReactNode } from "react";
import { Activity, CalendarCheck, ClipboardPen, Coins, UserRoundX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { formatContributionType, formatPaymentMethod } from "@/app/portal/contributions/types";
import { formatServiceType } from "@/app/portal/services/types";
import { METHOD_LABELS, OUTCOME_LABELS, type FollowUpMethod, type FollowUpOutcome } from "@/app/portal/follow-ups/types";
import ReportChart from "./ReportChart";
import ReportDashboardGroups from "./ReportDashboardGroups";
import ReportComparisonTicker, { type ReportComparison } from "./ReportComparisonTicker";
import MembershipOverviewCard from "./MembershipOverviewCard";
import MigrationAnalyticsPanel from "./MigrationAnalyticsPanel";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "./presentation";

const count = (value: number | null) => formatReportNumber(value);
function Stats({ items, comparisons }: { comparisons: Record<string, ReportComparison>; items: { label: string; value: string }[] }) {
  return <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4">
    <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
    <dd className="mt-2 break-words text-xl font-semibold tabular-nums text-[#203264]">{item.value}</dd>
    {comparisons[item.label] && <ReportComparisonTicker comparison={comparisons[item.label]} />}
  </div>)}</dl>;
}
function Section({ id, title, description, current, children }: { id: string; title: string; description: string; current?: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 space-y-4">
    <div className="space-y-1"><div className="flex flex-wrap items-center gap-3"><h2 id={`${id}-heading`} className="font-radio-canada text-xl font-semibold text-[#203264]">{title}</h2>
      {current && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-800">Current · {current}</span>}
    </div><p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p></div>
    {children}
  </section>;
}

export default function ReportsDashboard({ overview: data, previous = null, serviceTypeNames = {}, migration = null }: { overview: AnalyticsOverview; previous?: AnalyticsOverview | null; serviceTypeNames?: Record<string, string>; migration?: MigrationAnalytics | null }) {
  const { membership, attendance, inactivity, followUps, contributions, baptisms, branches } = data;
  const compare = (current: number | string | null, prior: number | string | null | undefined): ReportComparison => ({ current, previous: prior ?? null });
  const comparisons: Record<string, ReportComparison> = {
    "Completed Services": compare(attendance.completedServices, previous?.attendance.completedServices),
    "Avg Attendance / Service": compare(attendance.averagePerService, previous?.attendance.averagePerService),
    "Avg Attendance / Completed Service": compare(attendance.averagePerService, previous?.attendance.averagePerService),
    "Physical Check-ins": compare(attendance.physicalCheckIns, previous?.attendance.physicalCheckIns),
    "Unique Attendees": compare(attendance.uniqueMembers, previous?.attendance.uniqueMembers),
    "Registered Members": compare(membership.recordsAddedInRange, previous?.membership.recordsAddedInRange),
    "Follow-ups": compare(followUps.total, previous?.followUps.total),
    "Follow-ups in Period": compare(followUps.total, previous?.followUps.total),
    "Unique Members Followed Up": compare(followUps.uniqueMembers, previous?.followUps.uniqueMembers),
    "Total Contributions": compare(contributions.totalAmount, previous?.contributions.totalAmount),
    "Contribution Count": compare(contributions.count, previous?.contributions.count),
    "Average Contribution": compare(contributions.averageAmount, previous?.contributions.averageAmount),
    "Baptisms in Period": compare(baptisms.total, previous?.baptisms.total),
    "Water Baptisms": compare(baptisms.water, previous?.baptisms.water),
    "Holy Ghost Baptisms": compare(baptisms.holyGhost, previous?.baptisms.holyGhost),
  };
  const currentDate = formatReportDate(data.asOfDate);
  const multiple = branches.length > 1;
  const periodLabels = (points: { periodStart: string }[]) => points.map((point) => formatReportDate(point.periodStart));
  const periodNote = "Period start dates; activity is limited to the selected range. Periods without activity are omitted.";
  return <div className="min-w-0 space-y-7 tabular-nums">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm">
      <p className="font-medium text-[#203264]">{formatReportDate(data.range.from)} – {formatReportDate(data.range.to)}</p>
      <p className="text-slate-600">{multiple ? `${branches.length} accessible branches` : branches[0]?.branch.name ?? "No branches"} · Asia/Manila</p>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]" aria-label="Report overview">
      <MembershipOverviewCard overview={data} previous={previous} />
      <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Completed Services", value: count(attendance.completedServices), icon: CalendarCheck },
        { label: "Avg Attendance / Service", value: count(attendance.averagePerService), icon: Activity },
        { label: "Members Needing Follow-up", value: count(inactivity.needsFollowUpMembers), icon: UserRoundX },
        { label: "Follow-ups", value: count(followUps.total), icon: ClipboardPen },
        { label: "Total Contributions", value: formatReportMoney(contributions.totalAmount), icon: Coins },
      ].map(({ label, value, icon: Icon }) => <Card key={label} className={`min-w-0 ${label === "Total Contributions" ? "col-span-2" : ""}`}><CardContent className="min-w-0 p-4">
        <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-slate-500">{label}</p><Icon className="h-4 w-4 shrink-0 text-[#365FA6]" aria-hidden="true" /></div>
        <p className="mt-2 break-words text-xl font-semibold tabular-nums text-[#203264] sm:text-2xl">{value}</p>{comparisons[label] && <ReportComparisonTicker comparison={comparisons[label]} />}
      </CardContent></Card>)}
      </div>
    </div>

    <ReportDashboardGroups groups={[
{ id: "membership", label: "Membership", content: (
<Section id="membership" title="Membership" description="Member registrations in the selected period, alongside current membership status.">
      <Stats comparisons={comparisons} items={[
        { label: "Non-archived Members", value: count(membership.nonArchivedMembers) },
        { label: " Active Members", value: count(membership.storedActiveMembers) },
        { label: "Registered Members", value: count(membership.recordsAddedInRange) },
        { label: "Archived Members", value: count(membership.archivedMembers) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Member Registrations" description={periodNote} labels={periodLabels(membership.recordCreationTrend)}
          series={[{ label: "Registrations", values: membership.recordCreationTrend.map((point) => point.value) }]} kind="line" emptyMessage="No members registered in this period." />
        <ReportChart title="Recorded First Attendances" description="Historical reference dates for when people first attended church." labels={periodLabels(membership.firstAttendanceTrend)}
          series={[{ label: "First Attendances", values: membership.firstAttendanceTrend.map((point) => point.value), color: "#16836B" }]} kind="line" emptyMessage="No first-attendance dates were recorded in this period." />
      </div>
    </Section>
) },
{ id: "attendance", label: "Attendance", content: (
<Section id="attendance" title="Attendance" description="Physical attendance is present only at completed services. Excused entries are excluded, and each member is counted once per service.">
      <Stats comparisons={comparisons} items={[
        { label: "Completed Services", value: count(attendance.completedServices) }, { label: "Physical Check-ins", value: count(attendance.physicalCheckIns) },
        { label: "Unique Attendees", value: count(attendance.uniqueMembers) }, { label: "Avg Attendance / Completed Service", value: count(attendance.averagePerService) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Attendance Trend" description={periodNote} labels={periodLabels(attendance.trend)} kind="line"
          series={[{ label: "Physical Check-ins", values: attendance.trend.map((point) => point.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded at completed services in this period." />
        <ReportChart title="Attendance by Service Type" labels={attendance.byServiceType.map((point) => formatServiceType(point.serviceType, serviceTypeNames))} horizontal
          series={[{ label: "Physical Check-ins", values: attendance.byServiceType.map((point) => point.physicalCheckIns) }]} emptyMessage="There is no service-type attendance to compare in this period." />
        {multiple && <ReportChart title="Attendance by Branch" labels={branches.map((row) => row.branch.name)} horizontal
          series={[{ label: "Physical Check-ins", values: branches.map((row) => row.attendance.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded in these branches during this period." />}
      </div>
    </Section>
) },
{ id: "migrations", label: "Migration Analytics", content: (
<Section id="migrations" title="Migration Analytics" description="Branch transfers, departures and returns in the selected period.">
  {migration ? <MigrationAnalyticsPanel data={migration} range={data.range} headingLevel={3} /> : <FeedbackMessage>Migration analytics could not be loaded. Try applying the filters again.</FeedbackMessage>}
</Section>
) },
{ id: "inactivity", label: "Inactivity", content: (
<Section id="inactivity" title="Attendance Follow-up Flags" current={currentDate} description="Based on consecutive absent eligible weeks and each active branch’s threshold. These flags identify cases for human follow-up and never set administrative Member Status. The selected date range does not change current flags.">
      <Stats comparisons={comparisons} items={[
        { label: "Monitoring", value: count(inactivity.monitoringMembers) }, { label: "Needs Follow-up", value: count(inactivity.needsFollowUpMembers) },
        { label: "Unknown", value: count(inactivity.unknownMembers) },
        { label: "Needs Follow-up Among Calculable Members", value: formatReportPercent(inactivity.needsFollowUpPercent) },
        { label: "Approaching Threshold", value: count(inactivity.approachingFollowUpThreshold) },
        { label: "Average Absent-week Streak", value: count(inactivity.averageConsecutiveAbsentWeeks) },
      ]} />
      <ReportChart title="Current Attendance Flag" labels={["Monitoring", "Needs Follow-up", "Unknown"]} horizontal
        series={[{ label: "Members", values: [inactivity.monitoringMembers, inactivity.needsFollowUpMembers, inactivity.unknownMembers] }]}
        emptyMessage="There are no current monitoring members in the selected active branches." />
      {branches.some((row) => !row.branch.isActive) && <p className="text-xs text-slate-500">Inactive branches retain historical reports but are excluded from current inactivity monitoring.</p>}
    </Section>
) },
{ id: "follow-ups", label: "Follow-ups", content: (
<Section id="follow-ups" title="Follow-ups" description="Activity charts cover the selected period. Current needs and overdue dates use only each member’s latest follow-up within the selected branch scope; a later resolution supersedes an earlier need.">
      <Stats comparisons={comparisons} items={[
        { label: "Follow-ups in Period", value: count(followUps.total) }, { label: "Unique Members Followed Up", value: count(followUps.uniqueMembers) },
        { label: "Needs Follow-up · Current", value: count(followUps.latestNeedsFollowUpMembers) },
        { label: "Overdue Next Follow-ups · Current", value: count(followUps.overdueLatestNextFollowUps) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Follow-ups by Outcome" description="Outcomes recorded during the selected period; these are historical actions." labels={followUps.byOutcome.map((point) => OUTCOME_LABELS[point.outcome as FollowUpOutcome] ?? point.outcome)} horizontal
          series={[{ label: "Follow-ups", values: followUps.byOutcome.map((point) => point.count) }]} emptyMessage="No follow-up outcomes were recorded in this period." />
        <ReportChart title="Follow-ups by Method" labels={followUps.byMethod.map((point) => METHOD_LABELS[point.method as FollowUpMethod] ?? point.method)} horizontal
          series={[{ label: "Follow-ups", values: followUps.byMethod.map((point) => point.count) }]} emptyMessage="No follow-up methods were recorded in this period." />
        <ReportChart title="Follow-up Trend" description={periodNote} labels={periodLabels(followUps.trend)} kind="line"
          series={[{ label: "Follow-ups", values: followUps.trend.map((point) => point.value) }]} emptyMessage="No follow-ups were recorded in this period." />
      </div>
    </Section>
) },
{ id: "contributions", label: "Contributions", content: (
<Section id="contributions" title="Contributions" description="Contributions dated within the selected period, including Member, Visitor, and Anonymous contributions. All displayed peso amounts preserve exact decimal values.">
      <Stats comparisons={comparisons} items={[
        { label: "Total Contributions", value: formatReportMoney(contributions.totalAmount) }, { label: "Contribution Count", value: count(contributions.count) },
        { label: "Average Contribution", value: formatReportMoney(contributions.averageAmount) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Contribution Trend" description={periodNote} labels={periodLabels(contributions.trend)} money kind="line"
          series={[{ label: "Contributions", values: contributions.trend.map((point) => point.totalAmount) }]} emptyMessage="No contributions were recorded in this period." />
        <ReportChart title="Contributions by Type" labels={contributions.byContributionType.map((point) => formatContributionType(point.contributionType))} money horizontal
          series={[{ label: "Contributions", values: contributions.byContributionType.map((point) => point.totalAmount) }]} emptyMessage="There are no contribution types to compare in this period." />
        <ReportChart title="Contributions by Payment Method" labels={contributions.byPaymentMethod.map((point) => formatPaymentMethod(point.paymentMethod))} money horizontal
          series={[{ label: "Contributions", values: contributions.byPaymentMethod.map((point) => point.totalAmount) }]} emptyMessage="There are no payment methods to compare in this period." />
        {multiple && <ReportChart title="Contributions by Branch" labels={branches.map((row) => row.branch.name)} money horizontal
          series={[{ label: "Contributions", values: branches.map((row) => row.contributions.totalAmount) }]} emptyMessage="No contributions were recorded in these branches during this period." />}
      </div>
    </Section>
) },
{ id: "baptisms", label: "Baptisms", content: (
<Section id="baptisms" title="Baptisms" description="Date-range totals use recorded baptism dates. Undated historical records are shown separately and are excluded from these totals and trends.">
      <Stats comparisons={comparisons} items={[
        { label: "Baptisms in Period", value: count(baptisms.total) }, { label: "Water Baptisms", value: count(baptisms.water) },
        { label: "Holy Ghost Baptisms", value: count(baptisms.holyGhost) }, { label: "Undated Baptism Records", value: count(baptisms.undatedRecords) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Baptism Trend" description={periodNote} labels={periodLabels(baptisms.trend)} kind="line"
          series={[{ label: "Water", values: baptisms.trend.map((point) => point.water) }, { label: "Holy Ghost", values: baptisms.trend.map((point) => point.holyGhost) }]} emptyMessage="No dated baptisms were recorded in this period." />
        <ReportChart title="Water vs Holy Ghost" labels={["Water", "Holy Ghost"]} horizontal
          series={[{ label: "Baptisms", values: [baptisms.water, baptisms.holyGhost] }]} emptyMessage="No dated baptisms are available to compare in this period." />
        {multiple && <ReportChart title="Baptisms by Branch" labels={branches.map((row) => row.branch.name)} horizontal
          series={[{ label: "Water", values: branches.map((row) => row.baptisms.water) }, { label: "Holy Ghost", values: branches.map((row) => row.baptisms.holyGhost) }]} emptyMessage="No dated baptisms were recorded in these branches during this period." />}
      </div>
    </Section>
) },
...(multiple ? [{ id: "branches", label: "Branch Comparison", content: (
<Section id="branches" title="Branch Comparison" description="Members and attendance follow-up flags are current; service, follow-up, contribution, and dated baptism metrics cover the selected period. Unique attendees across branches are not additive.">
      <Table><caption className="sr-only">Accessible branch comparison</caption><TableHeader><TableRow>
        {["Branch", "Members", "Completed Services", "Avg Attendance / Service", "Needs Follow-up", "Follow-ups", "Contributions", "Water Baptisms", "Holy Ghost Baptisms"].map((label, index) => <TableHead key={label} scope="col" className={index ? "text-right" : ""}>{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>{branches.map((row) => <TableRow key={row.branch.id}>
        <TableHead scope="row" className="normal-case tracking-normal"><span className="font-medium text-slate-900">{row.branch.name}</span>{!row.branch.isActive && <span className="ml-2 text-xs text-slate-500">Inactive branch</span>}</TableHead>
        {[
          count(row.membership.nonArchivedMembers), count(row.attendance.completedServices), count(row.attendance.averagePerService),
          row.inactivity ? count(row.inactivity.needsFollowUpMembers) : "Unavailable", count(row.followUps.total), formatReportMoney(row.contributions.totalAmount), count(row.baptisms.water), count(row.baptisms.holyGhost),
        ].map((value, index) => <TableCell key={index} className="whitespace-nowrap text-right tabular-nums">{value}</TableCell>)}
      </TableRow>)}</TableBody></Table>
    </Section>
) }] : [])
    ]} />
  </div>;
}
