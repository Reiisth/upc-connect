import { AnimatedNumber } from "@/components/ui/animated-number";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { cumulativeMembershipSparkline, membershipSparklineDates } from "@/lib/analytics/registration-trend";
import { contributionTicker } from "@/lib/contribution-comparison";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { formatReportDate, formatReportNumber } from "./presentation";

export default function MembershipOverviewCard({ overview, previous, departures = null }: { overview: AnalyticsOverview; previous: AnalyticsOverview | null; departures?: number | null }) {
  const total = overview.membersAtEndDate;
  const prior = previous?.membersAtEndDate ?? null;
  const comparison = contributionTicker(total, prior);
  const direction = prior === 0 && total > 0 ? "up" : comparison.direction;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const text = prior === 0 && total > 0 ? `+${formatReportNumber(total)} vs previous period`
    : comparison.percent === null ? comparison.label : `${direction === "up" ? "+" : direction === "down" ? "−" : ""}${comparison.percent} vs previous period`;
  const animatedGrowth = prior === 0 && total > 0 ? `+${formatReportNumber(total)}` : comparison.percent === null ? null : `${direction === "up" ? "+" : direction === "down" ? "?" : ""}${comparison.percent}`;
  const values = cumulativeMembershipSparkline(overview.membership.recordCreationTrend, overview.range, overview.grouping, total);
  const previousValues = previous ? cumulativeMembershipSparkline(previous.membership.recordCreationTrend,previous.range,previous.grouping,previous.membersAtEndDate) : [];
  const labels=membershipSparklineDates(overview.range,overview.grouping).map((date,index)=>`${index===0?"Before":"As of"} ${formatReportDate(date)}`);
  const previousLabels=previous?membershipSparklineDates(previous.range,previous.grouping).map((date,index)=>`${index===0?"Before":"As of"} ${formatReportDate(date)}`):[];
  return <Card className="min-w-0 border-blue-200/70" role="region" aria-label="Total Members">
    <CardContent className="flex h-full min-w-0 flex-col gap-2 p-5 sm:p-6">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] items-start gap-3 sm:gap-5">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-slate-600">Total Members</h2>
          <AnimatedNumber as="p" className="break-words text-5xl font-semibold leading-none tracking-tight tabular-nums text-[#203264] sm:text-6xl" value={formatReportNumber(total)} />
          <p className="text-xs text-slate-500">As of <time dateTime={overview.range.to}>{formatReportDate(overview.range.to)}</time></p>
        </div>
        <div className="min-w-0 space-y-2">
        <p className={`flex items-start justify-end gap-1 text-right text-base font-semibold tabular-nums ${direction === "up" ? "text-emerald-700" : direction === "down" ? "text-red-700" : "text-slate-500"}`}
          title={previous ? `Compared with total members on ${formatReportDate(previous.range.to)}` : undefined}
          aria-label={`Membership growth: ${text}`}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><span>{animatedGrowth === null ? text : <AnimatedNumber value={animatedGrowth} />}</span>
        </p>
          <Sparkline values={values} previousValues={previousValues} pointLabels={labels} previousPointLabels={previousLabels} scaleKey="reports:cumulative-members" label={`Total members from ${overview.range.from} to ${overview.range.to}, ending at ${formatReportNumber(total)}. Each point includes all earlier registrations.${previous ? ` Grey comparison: ${previous.range.from} to ${previous.range.to}, ending at ${formatReportNumber(previous.membersAtEndDate)}. Periods align by relative progress.` : ""}`} className="min-w-0 text-[#5D94E8]" />
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] text-slate-500" aria-hidden="true"><span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-[#5D94E8]" />Current</span>{previous && <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-slate-400" />Previous</span>}</div>
        </div>
      </div>
      <dl className="mt-auto grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200/80 pt-4">
        <div className="min-w-0 pr-4" title="Member registrations within the selected date range.">
          <dt className="text-sm font-medium text-slate-500 sm:text-base">New Members</dt>
          <AnimatedNumber as="dd" value={formatReportNumber(overview.membership.recordsAddedInRange)} className="mt-1 break-words text-2xl font-semibold tabular-nums text-[#203264] sm:text-3xl" />
        </div>
        <div className="min-w-0 pl-4" title="Recorded departures from the church during the selected date range. Branch transfers are excluded.">
          <dt className="text-sm font-medium text-slate-500 sm:text-base">Departures</dt>
          <AnimatedNumber as="dd" value={formatReportNumber(departures)} className="mt-1 break-words text-2xl font-semibold tabular-nums text-[#203264] sm:text-3xl" />
        </div>
      </dl>
    </CardContent>
  </Card>;
}
