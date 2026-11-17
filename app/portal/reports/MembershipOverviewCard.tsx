import { ArrowDownRight, ArrowRight, ArrowUpRight, UsersRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import { cumulativeMembershipSparkline } from "@/lib/analytics/registration-trend";
import { contributionTicker } from "@/lib/contribution-comparison";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { formatReportDate, formatReportNumber } from "./presentation";

export default function MembershipOverviewCard({ overview, previous }: { overview: AnalyticsOverview; previous: AnalyticsOverview | null }) {
  const total = overview.membersAtEndDate;
  const prior = previous?.membersAtEndDate ?? null;
  const comparison = contributionTicker(total, prior);
  const direction = prior === 0 && total > 0 ? "up" : comparison.direction;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const text = prior === 0 && total > 0 ? `+${formatReportNumber(total)} vs previous period`
    : comparison.percent === null ? comparison.label : `${direction === "up" ? "+" : direction === "down" ? "−" : ""}${comparison.percent} vs previous period`;
  const values = cumulativeMembershipSparkline(overview.membership.recordCreationTrend, overview.range, overview.grouping, total);
  return <Card className="min-w-0 border-blue-200/70" role="region" aria-label="Total Members">
    <CardContent className="flex h-full min-w-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-600">Total Members</h2>
        <span className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#365FA6]"><UsersRound className="h-5 w-5" aria-hidden="true" /></span>
      </div>
      <div>
        <p className="break-words text-5xl font-semibold leading-none tracking-tight tabular-nums text-[#203264] sm:text-6xl">{formatReportNumber(total)}</p>
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold tabular-nums ${direction === "up" ? "text-emerald-700" : direction === "down" ? "text-red-700" : "text-slate-500"}`}
          title={previous ? `Compared with total members on ${formatReportDate(previous.range.to)}` : undefined}
          aria-label={`Membership growth: ${text}`}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{text}
        </p>
      </div>
      <div className="mt-auto space-y-2 pt-2">
        <p className="text-xs font-medium text-slate-500">Membership trend</p>
        <Sparkline values={values} scaleKey="reports:cumulative-members" label={`Total members from ${overview.range.from} to ${overview.range.to}, ending at ${formatReportNumber(total)}. Each point includes all earlier registrations.`} className="h-20 w-full text-[#365FA6]" />
      </div>
    </CardContent>
  </Card>;
}
