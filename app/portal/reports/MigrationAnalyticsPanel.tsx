import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalyticsDateRange } from "@/lib/analytics/types";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { formatManilaTimestamp } from "@/lib/manila-time";
import { manilaDateFromTimestamp } from "@/lib/inactivity/calculate";
import ReportChart from "./ReportChart";

export default function MigrationAnalyticsPanel({ data, range, headingLevel = 2 }: {
  data: MigrationAnalytics; range: AnalyticsDateRange; headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <div className="min-w-0 space-y-4 tabular-nums">
    <p className="text-sm text-slate-600">Tracking started {formatManilaTimestamp(data.trackingStartedAt)}. Earlier movements are unknown and are not backfilled. Dates use Asia/Manila.</p>
    {range.from <= (manilaDateFromTimestamp(data.trackingStartedAt) ?? "") && <FeedbackMessage variant="warning">This date range includes time before tracking began. Totals cover recorded movements only.</FeedbackMessage>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        ["Transfer Events", data.totals.transfers], ["Distinct Members Moved", data.totals.members],
        ["Transfers In", data.totals.incoming], ["Transfers Out", data.totals.outgoing],
        ["Departures", data.totals.departures], ["Returns", data.totals.returns], ["Net Movement", data.totals.net],
      ].map(([label,value]) => <Card key={label} className="min-w-0"><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-semibold text-[#203264]">{Number(value).toLocaleString("en-PH")}</p></CardContent></Card>)}
    </div>
    <p className="text-xs text-slate-500">A member can move multiple times. Transfers within the selected branches count once as an event, once in, and once out. Net movement = transfers in + returns − transfers out − departures; it is not total membership growth.</p>
    <ReportChart title="Member Movement Over Time" kind="bar" labels={data.trend.map(point => point.periodStart)}
      series={([ ["Transfers In", "incoming", "#16836B"], ["Transfers Out", "outgoing", "#365FA6"], ["Departures", "departures", "#B7791F"], ["Returns", "returns", "#8B5CB5"] ] as const).map(([label,key,color]) => ({ label, color, values: data.trend.map(point => point[key]) }))}
      emptyMessage="No recorded movements match this branch and date range." />
    <section className="space-y-3"><Heading className="text-lg font-semibold text-[#203264]">Movement by Branch</Heading>
      <Table mobileCards><TableHeader><TableRow>{["Branch","Transfers In","Transfers Out","Departures","Returns","Net"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{data.branches.length ? data.branches.map(branch => <TableRow key={branch.id}><TableCell data-label="Branch">{branch.name}</TableCell>{([['Transfers In',branch.incoming],['Transfers Out',branch.outgoing],['Departures',branch.departures],['Returns',branch.returns],['Net',branch.net]] as const).map(([label,value]) => <TableCell key={label} data-label={label} className="text-right">{value.toLocaleString("en-PH")}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={6}>No branch movements in this selection.</TableCell></TableRow>}</TableBody>
      </Table>
    </section>
    <section className="space-y-3"><Heading className="text-lg font-semibold text-[#203264]">Transfer Routes</Heading>
      <Table mobileCards><TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Transfers</TableHead></TableRow></TableHeader>
        <TableBody>{data.flows.length ? data.flows.map((flow,index) => <TableRow key={index}><TableCell data-label="From">{flow.source}</TableCell><TableCell data-label="To">{flow.destination}</TableCell><TableCell data-label="Transfers" className="text-right">{flow.transfers.toLocaleString("en-PH")}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3}>No transfers in this selection.</TableCell></TableRow>}</TableBody>
      </Table>
    </section>
  </div>;
}
