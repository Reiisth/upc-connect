import type { ReactNode } from "react";
import { Activity, CalendarCheck, ClipboardPen, Coins, UsersRound, UserRoundX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { formatContributionType, formatPaymentMethod } from "@/app/portal/contributions/types";
import { formatServiceType } from "@/app/portal/services/types";
import { METHOD_LABELS, OUTCOME_LABELS, type FollowUpMethod, type FollowUpOutcome } from "@/app/portal/follow-ups/types";
import ReportChart from "./ReportChart";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "./presentation";

const count = (value: number | null) => formatReportNumber(value);
function Stats({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4">
    <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
    <dd className="mt-2 break-words text-xl font-semibold tabular-nums text-[#203264]">{item.value}</dd>
    {item.note && <dd className="mt-1 text-xs text-slate-500">{item.note}</dd>}
  </div>)}</dl>;
}
function Section({ id, title, description, current, children }: { id: string; title: string; description: string; current?: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6 space-y-4 border-t border-slate-200 pt-7">
    <div className="space-y-1"><div className="flex flex-wrap items-center gap-3"><h2 id={`${id}-heading`} className="font-radio-canada text-xl font-semibold text-[#203264]">{title}</h2>
      {current && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-800">Current · {current}</span>}
    </div><p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p></div>
    {children}
  </section>;
}

export default function ReportsDashboard({ overview: data }: { overview: AnalyticsOverview }) {
  const { membership, attendance, inactivity, followUps, contributions, baptisms, branches } = data;
  const currentDate = formatReportDate(data.asOfDate);
  const multiple = branches.length > 1;
  const periodLabels = (points: { periodStart: string }[]) => points.map((point) => formatReportDate(point.periodStart));
  const periodNote = "Period start dates; activity is limited to the selected range. Periods without activity are omitted.";
  return <div className="min-w-0 space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm">
      <p className="font-medium text-[#203264]">{formatReportDate(data.range.from)} – {formatReportDate(data.range.to)}</p>
      <p className="text-slate-600">{multiple ? `${branches.length} accessible branches` : branches[0]?.branch.name ?? "No branches"} · Asia/Manila</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Report overview">
      {[
        { label: "Total Members", value: count(membership.nonArchivedMembers), note: "Current non-archived members", icon: UsersRound },
        { label: "Completed Services", value: count(attendance.completedServices), note: "In the selected period", icon: CalendarCheck },
        { label: "Avg Attendance / Service", value: count(attendance.averagePerService), note: "Physical attendance at completed services", icon: Activity },
        { label: "Derived Inactive Members", value: count(inactivity.derivedInactiveMembers), note: `Current · ${currentDate}`, icon: UserRoundX },
        { label: "Follow-ups", value: count(followUps.total), note: "Recorded in the selected period", icon: ClipboardPen },
        { label: "Total Contributions", value: formatReportMoney(contributions.totalAmount), note: "Includes anonymous contributions", icon: Coins },
      ].map(({ label, value, note, icon: Icon }) => <Card key={label}><CardContent className="min-w-0 p-5">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><Icon className="h-5 w-5 shrink-0 text-[#5D94E8]" aria-hidden="true" /></div>
        <p className="mt-3 break-words text-2xl font-semibold tabular-nums text-[#203264]">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p>
      </CardContent></Card>)}
    </div>

    <nav aria-label="Report sections" className="flex flex-wrap gap-2">{[
      ["membership", "Membership"], ["attendance", "Attendance"], ["weekly", "Weekly Participation"], ["inactivity", "Inactivity"], ["follow-ups", "Follow-ups"], ["contributions", "Contributions"], ["baptisms", "Baptisms"], ...(multiple ? [["branches", "Branch Comparison"]] : []),
    ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#365FA6] transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2">{label}</a>)}</nav>

    <Section id="membership" title="Membership" description="Current member counts and records added during the selected period. Record creation is not a guaranteed official membership start date.">
      <Stats items={[
        { label: "Non-archived Members", value: count(membership.nonArchivedMembers) },
        { label: "Stored Active Members", value: count(membership.storedActiveMembers), note: "Administrative status, separate from derived inactivity" },
        { label: "Member Records Added", value: count(membership.recordsAddedInRange), note: "Based on record creation date" },
        { label: "Archived Members", value: count(membership.archivedMembers), note: "Current archive state" },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Member Records Added" description={periodNote} labels={periodLabels(membership.recordCreationTrend)}
          series={[{ label: "Records Added", values: membership.recordCreationTrend.map((point) => point.value) }]} kind="line" emptyMessage="No member records were created in this period." />
        <ReportChart title="Recorded First Attendances" description="Recorded first-attendance dates, separate from record creation and official membership acceptance." labels={periodLabels(membership.firstAttendanceTrend)}
          series={[{ label: "First Attendances", values: membership.firstAttendanceTrend.map((point) => point.value), color: "#16836B" }]} kind="line" emptyMessage="No first-attendance dates were recorded in this period." />
      </div>
    </Section>

    <Section id="attendance" title="Attendance" description="Physical attendance is present + late at completed services. Excused entries are excluded, and each member is counted once per service.">
      <Stats items={[
        { label: "Completed Services", value: count(attendance.completedServices) }, { label: "Physical Check-ins", value: count(attendance.physicalCheckIns) },
        { label: "Unique Attendees", value: count(attendance.uniqueMembers), note: "Deduplicated across the selected scope" }, { label: "Avg Attendance / Completed Service", value: count(attendance.averagePerService) },
      ]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReportChart title="Attendance Trend" description={periodNote} labels={periodLabels(attendance.trend)} kind="line"
          series={[{ label: "Physical Check-ins", values: attendance.trend.map((point) => point.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded at completed services in this period." />
        <ReportChart title="Attendance by Service Type" labels={attendance.byServiceType.map((point) => formatServiceType(point.serviceType))} horizontal
          series={[{ label: "Physical Check-ins", values: attendance.byServiceType.map((point) => point.physicalCheckIns) }]} emptyMessage="There is no service-type attendance to compare in this period." />
        {multiple && <ReportChart title="Attendance by Branch" labels={branches.map((row) => row.branch.name)} horizontal
          series={[{ label: "Physical Check-ins", values: branches.map((row) => row.attendance.physicalCheckIns) }]} emptyMessage="No physical attendance was recorded in these branches during this period." />}
      </div>
    </Section>

    <Section id="weekly" title="Weekly Participation" description="Unique attendees in Monday–Sunday weeks. Current and clipped weeks can show activity but do not count as full finished completed-service weeks.">
      <Stats items={[
        { label: "Full Finished Service Weeks", value: count(attendance.eligibleCompletedServiceWeeks) },
        { label: "Participation Rate", value: "Unavailable", note: "Not enough reliable historical eligibility data" },
      ]} />
      <ReportChart title="Weekly Unique Attendees" description="Weekly counts stay weekly regardless of the trend grouping filter." labels={attendance.weekly.map((point) => `${formatReportDate(point.weekStart)}${!point.isFinished ? " · unfinished" : point.isPartialRange ? " · partial" : ""}`)} kind="line"
        series={[{ label: "Unique Attendees", values: attendance.weekly.map((point) => point.uniqueMembers) }]} emptyMessage="No weekly physical attendance is available for this period." />
    </Section>

    <Section id="inactivity" title="Derived Inactivity" current={currentDate} description="Based on consecutive absent eligible weeks and each active branch’s own threshold. Stored member status does not control these results; the selected date range does not change current state.">
      <Stats items={[
        { label: "Derived Active", value: count(inactivity.derivedActiveMembers) }, { label: "Derived Inactive", value: count(inactivity.derivedInactiveMembers) },
        { label: "Unknown", value: count(inactivity.unknownMembers), note: "Missing or invalid first-attendance date" },
        { label: "Inactive Among Calculable Members", value: formatReportPercent(inactivity.inactivePercent) },
        { label: "One Week Away", value: count(inactivity.oneWeekAwayMembers) },
        { label: "Average Absent-week Streak", value: count(inactivity.averageConsecutiveAbsentWeeks), note: "Calculable members only" },
      ]} />
      <ReportChart title="Current Attendance-derived Status" labels={["Derived Active", "Derived Inactive", "Unknown"]} horizontal
        series={[{ label: "Members", values: [inactivity.derivedActiveMembers, inactivity.derivedInactiveMembers, inactivity.unknownMembers] }]}
        emptyMessage="There are no current monitoring members in the selected active branches." />
      {branches.some((row) => !row.branch.isActive) && <p className="text-xs text-slate-500">Inactive branches retain historical reports but are excluded from current inactivity monitoring.</p>}
    </Section>

    <Section id="follow-ups" title="Follow-ups" description="Activity charts cover the selected period. Current needs and overdue dates use only each member’s latest follow-up within the selected branch scope; a later resolution supersedes an earlier need.">
      <Stats items={[
        { label: "Follow-ups in Period", value: count(followUps.total) }, { label: "Unique Members Followed Up", value: count(followUps.uniqueMembers) },
        { label: "Needs Follow-up · Current", value: count(followUps.latestNeedsFollowUpMembers), note: `Latest outcome as of ${currentDate}` },
        { label: "Overdue Next Follow-ups · Current", value: count(followUps.overdueLatestNextFollowUps), note: "Latest explicit next date is before today" },
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

    <Section id="contributions" title="Contributions" description="Contributions dated within the selected period, including anonymous contributions. All displayed peso amounts preserve exact decimal values.">
      <Stats items={[
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

    <Section id="baptisms" title="Baptisms" description="Date-range totals use recorded baptism dates. Undated historical records are shown separately and are excluded from these totals and trends.">
      <Stats items={[
        { label: "Baptisms in Period", value: count(baptisms.total) }, { label: "Water Baptisms", value: count(baptisms.water) },
        { label: "Holy Ghost Baptisms", value: count(baptisms.holyGhost) }, { label: "Undated Baptism Records", value: count(baptisms.undatedRecords), note: "Current data quality · outside date-range totals" },
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

    {multiple && <Section id="branches" title="Branch Comparison" description="Members and derived inactivity are current; service, follow-up, contribution, and dated baptism metrics cover the selected period. Unique attendees across branches are not additive.">
      <Table><caption className="sr-only">Accessible branch comparison</caption><TableHeader><TableRow>
        {["Branch", "Members", "Completed Services", "Avg Attendance / Service", "Derived Inactive", "Follow-ups", "Contributions", "Water Baptisms", "Holy Ghost Baptisms"].map((label, index) => <TableHead key={label} scope="col" className={index ? "text-right" : ""}>{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>{branches.map((row) => <TableRow key={row.branch.id}>
        <TableHead scope="row" className="normal-case tracking-normal"><span className="font-medium text-slate-900">{row.branch.name}</span>{!row.branch.isActive && <span className="ml-2 text-xs text-slate-500">Inactive branch</span>}</TableHead>
        {[
          count(row.membership.nonArchivedMembers), count(row.attendance.completedServices), count(row.attendance.averagePerService),
          row.inactivity ? count(row.inactivity.derivedInactiveMembers) : "Unavailable", count(row.followUps.total), formatReportMoney(row.contributions.totalAmount), count(row.baptisms.water), count(row.baptisms.holyGhost),
        ].map((value, index) => <TableCell key={index} className="whitespace-nowrap text-right tabular-nums">{value}</TableCell>)}
      </TableRow>)}</TableBody></Table>
    </Section>}
  </div>;
}
