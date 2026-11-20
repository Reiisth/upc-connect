import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsDateRange, AnalyticsGrouping } from "@/lib/analytics/types";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { manilaDateFromTimestamp } from "@/lib/inactivity/calculate";
import MigrationMovementChart from "./MigrationMovementChart";
import MigrationFlow from "./MigrationFlow";

export default function MigrationAnalyticsPanel({ data, range, grouping = "week", headingLevel = 2 }: {
  data: MigrationAnalytics; range: AnalyticsDateRange; grouping?: AnalyticsGrouping; headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <div className="min-w-0 space-y-4 tabular-nums">
    {range.from < (manilaDateFromTimestamp(data.trackingStartedAt) ?? "") && <FeedbackMessage variant="warning">Earlier movement history is unavailable.</FeedbackMessage>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        ["Transfer Events", data.totals.transfers], ["Distinct Members Moved", data.totals.members],
        ["Departures", data.totals.departures], ["Returns", data.totals.returns],
      ].map(([label,value]) => <Card key={label} className="min-w-0"><CardContent className="p-4"><p className="text-sm font-medium text-slate-500 sm:text-base">{label}</p><AnimatedNumber as="p" className="mt-1 break-words text-2xl font-semibold text-[#203264]" value={Number(value).toLocaleString("en-PH")} /></CardContent></Card>)}
    </div>
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
    <MigrationFlow data={data} range={range} compact />
    <div className="grid min-w-0 gap-4">
    <section className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><Heading className="text-lg font-semibold text-[#203264]">Movement by Branch</Heading>
      <div className="max-h-80 overflow-auto">
      <Table mobileCards><TableHeader><TableRow>{["Branch","Transfers In","Transfers Out","Departures","Returns","Net"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{data.branches.length ? data.branches.map(branch => <TableRow key={branch.id}><TableCell data-label="Branch">{branch.name}</TableCell>{([['Transfers In',branch.incoming],['Transfers Out',branch.outgoing],['Departures',branch.departures],['Returns',branch.returns],['Net',branch.net]] as const).map(([label,value]) => <TableCell key={label} data-label={label} className="text-right">{value.toLocaleString("en-PH")}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={6}>No branch movements in this selection.</TableCell></TableRow>}</TableBody>
      </Table>
      </div>
    </section>
    <MigrationMovementChart key={`${range.from}:${range.to}:${grouping}:${data.branches.map(branch => branch.id).join(",")}`} trend={data.trend} branches={data.branches} range={range} grouping={grouping} />
    </div>
    </div>
  </div>;
}
