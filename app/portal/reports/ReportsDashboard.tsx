import { AnimatedNumber } from "@/components/ui/animated-number";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsOverview, MemberStatusHistory, MostAttendedService } from "@/lib/analytics/types";
import { memberStatusSnapshot } from "@/lib/analytics/member-status-presentation";
import { formatContributionType, formatPaymentMethod } from "@/app/portal/contributions/types";
import { formatServiceType } from "@/app/portal/services/types";
import { METHOD_LABELS, OUTCOME_LABELS, type FollowUpMethod, type FollowUpOutcome } from "@/app/portal/follow-ups/types";
import ReportChart from "./ReportChart";
import ScopedReportChart from "./ScopedReportChart";
import ServiceTypeAttendanceChart from "./ServiceTypeAttendanceChart";
import ReportDashboardGroups from "./ReportDashboardGroups";
import ReportComparisonTicker, { type ReportComparison } from "./ReportComparisonTicker";
import MembershipOverviewCard from "./MembershipOverviewCard";
import MigrationAnalyticsPanel from "./MigrationAnalyticsPanel";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "./presentation";

const HOLY_GHOST_COLOR = "#D97706";
const count = (value: number | null) => formatReportNumber(value);
function Stats({ items, comparisons }: { comparisons: Record<string, ReportComparison>; items: { label: string; value: string; detail?: { value: string; label: string }; animate?: boolean }[] }) {
  return <dl className={`grid gap-3 sm:grid-cols-2 ${items.length === 3 || items.length === 6 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>{items.map((item) => <div key={item.label} className="grid min-w-0 grid-cols-1 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-3">
    <dt className="col-span-full text-sm font-medium text-slate-500 sm:text-base">{item.label}</dt>
    {item.animate === false ? <dd title={item.value} className="min-w-0 line-clamp-2 break-words text-xl font-semibold text-[#203264]">{item.value}</dd> : <AnimatedNumber as="dd" className="break-words text-xl font-semibold tabular-nums text-[#203264]" value={item.value} />}
    {item.detail && <dd aria-label={`${item.detail.value} ${item.detail.label}`} className="min-w-0 tabular-nums lg:max-w-28 lg:text-right"><AnimatedNumber className="block text-base font-semibold text-[#203264]" value={item.detail.value} /><span className="mt-0.5 block text-xs font-normal leading-tight text-slate-500">{item.detail.label}</span></dd>}
    {comparisons[item.label] && <dd className="min-w-0 lg:max-w-36"><ReportComparisonTicker comparison={comparisons[item.label]} className="mt-0 text-base lg:justify-end lg:text-right" /></dd>}
  </div>)}</dl>;
}
function Section({ id, title, description, current, children }: { id: string; title: string; description?: string; current?: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className="min-w-0 space-y-4">
    <div className="space-y-1"><div className="flex flex-wrap items-center gap-3"><h2 id={`${id}-heading`} className="font-radio-canada text-xl font-semibold text-[#203264]">{title}</h2>
      {current && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-800">Current · {current}</span>}
    </div>{description && <p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>}</div>
    {children}
  </section>;
}

export default function ReportsDashboard({ overview: data, previous = null, serviceTypeNames = {}, migration = null, statusHistory = null, previousStatusHistory = null, mostAttendedService }: { overview: AnalyticsOverview; previous?: AnalyticsOverview | null; serviceTypeNames?: Record<string, string>; migration?: MigrationAnalytics | null; statusHistory?: MemberStatusHistory | null; previousStatusHistory?: MemberStatusHistory | null; mostAttendedService?: MostAttendedService | null }) {
  const { membership, attendance, inactivity, followUps, contributions, baptisms, branches } = data;
  const mostAttendedType = attendance.byServiceType.filter(type => type.completedServices > 0).reduce<(typeof attendance.byServiceType)[number] | null>((best, type) => {
    const average = type.physicalCheckIns / type.completedServices;
    const bestAverage = best ? best.physicalCheckIns / best.completedServices : -1;
    return average > bestAverage || (average === bestAverage && best && type.serviceType.localeCompare(best.serviceType) < 0) ? type : best;
  }, null);
  const status = memberStatusSnapshot(data, statusHistory);
  const statusTotal = status.active !== null && status.inactive !== null ? status.active + status.inactive : null;
  const activePercent = statusTotal !== null && statusTotal > 0 && status.active !== null ? formatReportPercent(status.active / statusTotal * 100) : undefined;
  const priorDate = new Date(Date.parse(`${data.range.from}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
  const priorStatus = previousStatusHistory?.points.find(point => point.asOfDate === priorDate);
  const compare = (current: number | string | null, prior: number | string | null | undefined): ReportComparison => ({ current, previous: prior ?? null });
  const comparisons: Record<string, ReportComparison> = {
    "Active Members": compare(status.active, priorStatus?.active),
    "Inactive Members": compare(status.inactive, priorStatus?.inactive),
    "Completed Services": compare(attendance.completedServices, previous?.attendance.completedServices),
    "Avg Attendance / Service": compare(attendance.averagePerService, previous?.attendance.averagePerService),
    "Physical Check-ins": compare(attendance.physicalCheckIns, previous?.attendance.physicalCheckIns),
    "Unique Attendees": compare(attendance.uniqueMembers, previous?.attendance.uniqueMembers),
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
  return <div className="min-w-0 space-y-7 tabular-nums">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]" aria-label="Dashboard overview">
      <MembershipOverviewCard overview={data} previous={previous} departures={migration?.totals.departures ?? null} />
      <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Completed Services", value: count(attendance.completedServices) },
        { label: "Avg Attendance / Service", value: count(attendance.averagePerService) },
        { label: "Members Needing Follow-up", value: count(inactivity.needsFollowUpMembers) },
        { label: "Total Contributions", value: formatReportMoney(contributions.totalAmount) },
      ].map(({ label, value }) => <Card key={label} className="min-w-0"><CardContent className="min-w-0 p-4">
        <p className="text-sm font-medium text-slate-500 sm:text-base">{label}</p>
        <div className="mt-1 flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <AnimatedNumber as="p" className="min-w-0 break-words text-2xl font-semibold tabular-nums text-[#203264] sm:text-3xl" value={value} />
          {comparisons[label] && <ReportComparisonTicker comparison={comparisons[label]} className="mt-0 text-base lg:max-w-[55%] lg:justify-end lg:text-right" />}
        </div>
      </CardContent></Card>)}
      </div>
    </div>

    <ReportDashboardGroups groups={[
{ id: "membership", label: "Membership", content: (
<Section id="membership" title="Membership">
      <Stats comparisons={comparisons} items={[
        { label: "Non-archived Members", value: count(membership.nonArchivedMembers) },
        { label: "Active Members", value: count(status.active) },
        { label: "Inactive Members", value: count(status.inactive) },
        { label: "Archived Members", value: count(membership.archivedMembers) },
      ]} />
      <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ReportChart title="Member Status Distribution" appearance="sparkline" kind="doughnut" cutout="62%" plotHeight={272}
          className="flex flex-col [&>div:last-child]:flex [&>div:last-child]:flex-1 [&>div:last-child]:flex-col [&>div:last-child]:justify-between"
          description={`As of ${formatReportDate(status.date)}.`}
          labels={["Active Members", "Inactive Members"]} categoryColors={["#5D94E8", "#94A3B8"]} valueUnit="members"
          centerLabel="Active members" centerValue={activePercent}
          series={[{ label: "Members", values: status.active !== null && status.inactive !== null ? [status.active, status.inactive] : [null, null] }]}
          emptyMessage={status.active === null || status.inactive === null ? "Member status counts are unavailable for this date." : "No active or inactive members in the selected branches."} />
        <div className="grid min-w-0 gap-3">
        <ReportChart title="Member Registrations" appearance="sparkline" compactHeader plotHeight={160} labels={periodLabels(membership.recordCreationTrend)}
          series={[{ label: "Registrations", values: membership.recordCreationTrend.map((point) => point.value) }]} kind="line" emptyMessage="No members registered in this period." />
      {statusHistory ? <ReportChart title="Active and Inactive Members" appearance="sparkline" kind="line" showZeroData compact compactHeader plotHeight={136}
        labels={statusHistory.points.map(point => formatReportDate(point.asOfDate))}
        series={[{ label: "Active Members", values: statusHistory.points.map(point => point.active), color: "#5D94E8" }, { label: "Inactive Members", values: statusHistory.points.map(point => point.inactive), color: "#94A3B8" }]}
        emptyMessage="No tracked member status counts are available in this period. Choose a date range that includes the tracking start date." />
        : <FeedbackMessage>Member status history could not be loaded. Try applying the filters again.</FeedbackMessage>}
        </div>
      </div>
    </Section>
) },
{ id: "attendance", label: "Attendance", content: (
<Section id="attendance" title="Attendance">
      <Stats comparisons={comparisons} items={[
        { label: "Completed Services", value: count(attendance.completedServices) },
        { label: "Unique Attendees", value: count(attendance.uniqueMembers) },
        { label: "Most Attended Service Type", animate: false, value: mostAttendedType ? formatServiceType(mostAttendedType.serviceType, serviceTypeNames) : "No completed services", detail: mostAttendedType ? { value: count(mostAttendedType.physicalCheckIns / mostAttendedType.completedServices), label: "avg attendees/service" } : undefined },
        { label: "Most Attended Service", animate: false, value: mostAttendedService?.name ?? (mostAttendedService === null ? "No completed services" : "Unavailable"), detail: mostAttendedService ? { value: count(mostAttendedService.attendees), label: mostAttendedService.attendees === 1 ? "attendee" : "attendees" } : undefined },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Recorded First Attendances" appearance="sparkline" compactHeader plotHeight={160} labels={periodLabels(membership.firstAttendanceTrend)}
          series={[{ label: "First Attendances", values: membership.firstAttendanceTrend.map((point) => point.value) }]} kind="line" emptyMessage="No first-attendance dates were recorded in this period." />
        <ReportChart title="Attendance Trend" appearance="sparkline" compactHeader plotHeight={160} labels={periodLabels(attendance.trend)} kind="line"
          series={[{ label: "Physical Check-ins", values: attendance.trend.map((point) => point.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded at completed services in this period." />
        <ServiceTypeAttendanceChart types={attendance.byServiceType.map(point => ({label: formatServiceType(point.serviceType, serviceTypeNames), attendance: point.physicalCheckIns, completedServices: point.completedServices}))} />
        {multiple && <ReportChart title="Attendance by Branch" appearance="sparkline" compactHeader labels={branches.map((row) => row.branch.name)} horizontal
          series={[{ label: "Physical Check-ins", values: branches.map((row) => row.attendance.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded in these branches during this period." />}
      </div>
    </Section>
) },
{ id: "migrations", label: "Migration Analytics", content: (
<Section id="migrations" title="Migration Analytics">
  {migration ? <MigrationAnalyticsPanel data={migration} range={data.range} grouping={data.grouping} headingLevel={3} /> : <FeedbackMessage>Migration analytics could not be loaded. Try applying the filters again.</FeedbackMessage>}
</Section>
) },
{ id: "inactivity", label: "Inactivity", content: (
<Section id="inactivity" title="Attendance Follow-up Flags" current={currentDate}>
      <Stats comparisons={comparisons} items={[
        { label: "Monitoring", value: count(inactivity.monitoringMembers) }, { label: "Needs Follow-up", value: count(inactivity.needsFollowUpMembers) },
        { label: "Unknown", value: count(inactivity.unknownMembers) },
        { label: "Needs Follow-up Among Calculable Members", value: formatReportPercent(inactivity.needsFollowUpPercent) },
        { label: "Approaching Threshold", value: count(inactivity.approachingFollowUpThreshold) },
        { label: "Average Absent-week Streak", value: count(inactivity.averageConsecutiveAbsentWeeks) },
      ]} />
      <ScopedReportChart title="Current Attendance Flag"
        branches={branches.map(row => ({id:row.branch.id,name:row.branch.name,labels:["Monitoring","Needs Follow-up","Unknown"],unavailable:!row.inactivity,series:[{label:"Members",values:row.inactivity ? [row.inactivity.monitoringMembers,row.inactivity.needsFollowUpMembers,row.inactivity.unknownMembers] : [null,null,null]}]}))} appearance="sparkline" compactHeader labels={["Monitoring", "Needs Follow-up", "Unknown"]} horizontal
        series={[{ label: "Members", values: [inactivity.monitoringMembers, inactivity.needsFollowUpMembers, inactivity.unknownMembers] }]}
        emptyMessage="There are no current monitoring members in the selected active branches." />
    </Section>
) },
{ id: "follow-ups", label: "Follow-ups", content: (
<Section id="follow-ups" title="Follow-ups">
      <Stats comparisons={comparisons} items={[
        { label: "Follow-ups in Period", value: count(followUps.total) }, { label: "Unique Members Followed Up", value: count(followUps.uniqueMembers) },
        { label: "Needs Follow-up · Current", value: count(followUps.latestNeedsFollowUpMembers) },
        { label: "Overdue Next Follow-ups · Current", value: count(followUps.overdueLatestNextFollowUps) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Follow-ups by Outcome" appearance="sparkline" compactHeader labels={followUps.byOutcome.map((point) => OUTCOME_LABELS[point.outcome as FollowUpOutcome] ?? point.outcome)} horizontal
          series={[{ label: "Follow-ups", values: followUps.byOutcome.map((point) => point.count) }]} emptyMessage="No follow-up outcomes were recorded in this period." />
        <ReportChart title="Follow-ups by Method" appearance="sparkline" compactHeader labels={followUps.byMethod.map((point) => METHOD_LABELS[point.method as FollowUpMethod] ?? point.method)} horizontal
          series={[{ label: "Follow-ups", values: followUps.byMethod.map((point) => point.count) }]} emptyMessage="No follow-up methods were recorded in this period." />
        <ScopedReportChart title="Follow-up Trend"
          branches={branches.map(row => ({id:row.branch.id,name:row.branch.name,labels:periodLabels(row.followUps.trend),series:[{label:"Follow-ups",values:row.followUps.trend.map(point => point.value)}]}))} appearance="sparkline" compactHeader labels={periodLabels(followUps.trend)} kind="line" plotHeight={160}
          series={[{ label: "Follow-ups", values: followUps.trend.map((point) => point.value) }]} emptyMessage="No follow-ups were recorded in this period." />
      </div>
    </Section>
) },
{ id: "contributions", label: "Contributions", content: (
<Section id="contributions" title="Contributions">
      <Stats comparisons={comparisons} items={[
        { label: "Total Contributions", value: formatReportMoney(contributions.totalAmount) }, { label: "Contribution Count", value: count(contributions.count) },
        { label: "Average Contribution", value: formatReportMoney(contributions.averageAmount) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ScopedReportChart title="Contribution Trend"
          branches={branches.map(row => ({id:row.branch.id,name:row.branch.name,labels:periodLabels(row.contributions.trend),series:[{label:"Contributions",values:row.contributions.trend.map(point => point.totalAmount)}]}))} appearance="sparkline" compactHeader labels={periodLabels(contributions.trend)} money kind="line" plotHeight={160}
          series={[{ label: "Contributions", values: contributions.trend.map((point) => point.totalAmount) }]} emptyMessage="No contributions were recorded in this period." />
        <ReportChart title="Contributions by Type" appearance="sparkline" compactHeader labels={contributions.byContributionType.map((point) => formatContributionType(point.contributionType))} money horizontal
          series={[{ label: "Contributions", values: contributions.byContributionType.map((point) => point.totalAmount) }]} emptyMessage="There are no contribution types to compare in this period." />
        <ReportChart title="Contributions by Payment Method" appearance="sparkline" compactHeader labels={contributions.byPaymentMethod.map((point) => formatPaymentMethod(point.paymentMethod))} money horizontal
          series={[{ label: "Contributions", values: contributions.byPaymentMethod.map((point) => point.totalAmount) }]} emptyMessage="There are no payment methods to compare in this period." />
        {multiple && <ReportChart title="Contributions by Branch" appearance="sparkline" compactHeader labels={branches.map((row) => row.branch.name)} money horizontal
          series={[{ label: "Contributions", values: branches.map((row) => row.contributions.totalAmount) }]} emptyMessage="No contributions were recorded in these branches during this period." />}
      </div>
    </Section>
) },
{ id: "baptisms", label: "Baptisms", content: (
<Section id="baptisms" title="Baptisms">
      <Stats comparisons={comparisons} items={[
        { label: "Baptisms in Period", value: count(baptisms.total) }, { label: "Water Baptisms", value: count(baptisms.water) },
        { label: "Holy Ghost Baptisms", value: count(baptisms.holyGhost) }, { label: "Undated Baptism Records", value: count(baptisms.undatedRecords) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ScopedReportChart title="Baptism Trend" allowSeriesSelection
          branches={branches.map(row => ({id:row.branch.id,name:row.branch.name,labels:periodLabels(row.baptisms.trend),series:[{label:"Water",values:row.baptisms.trend.map(point => point.water)},{label:"Holy Ghost",color:HOLY_GHOST_COLOR,values:row.baptisms.trend.map(point => point.holyGhost)}]}))} appearance="sparkline" compactHeader labels={periodLabels(baptisms.trend)} kind="line" plotHeight={160}
          series={[{ label: "Water", values: baptisms.trend.map((point) => point.water) }, { label: "Holy Ghost", color: HOLY_GHOST_COLOR, values: baptisms.trend.map((point) => point.holyGhost) }]} emptyMessage="No dated baptisms were recorded in this period." />
        <ReportChart title="Water vs Holy Ghost" categoryColors={["#5D94E8", HOLY_GHOST_COLOR]} appearance="sparkline" compactHeader labels={["Water", "Holy Ghost"]} horizontal
          series={[{ label: "Baptisms", values: [baptisms.water, baptisms.holyGhost] }]} emptyMessage="No dated baptisms are available to compare in this period." />
        {multiple && <ScopedReportChart title="Baptisms by Branch" allowSeriesSelection appearance="sparkline" compactHeader labels={branches.map((row) => row.branch.name)} horizontal
          series={[{ label: "Water", values: branches.map((row) => row.baptisms.water) }, { label: "Holy Ghost", color: HOLY_GHOST_COLOR, values: branches.map((row) => row.baptisms.holyGhost) }]} emptyMessage="No dated baptisms were recorded in these branches during this period." />}
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
