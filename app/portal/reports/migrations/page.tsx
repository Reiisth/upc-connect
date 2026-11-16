import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyticsToday, resolveAnalyticsDateRange } from "@/lib/analytics/date-range";
import { formatManilaTimestamp } from "@/lib/manila-time";
import { manilaDateFromTimestamp } from "@/lib/inactivity/calculate";
import { getMigrationAnalytics, getMigrationReportingContext, type MigrationAnalytics } from "@/lib/member-migrations/server";
import { hasPermission } from "@/lib/permissions";
import ReportFilters from "../ReportFilters";
import ReportChart from "../ReportChart";
import { parseReportFilters, type ReportSearchParams } from "../filters";

type Props = { searchParams: Promise<ReportSearchParams> };
export default function MigrationReportsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton kind="dashboard" label="member migration" />}><Content {...props} /></Suspense>;
}
async function Content({ searchParams }: Props) { return CachedContent({ searchParams: await searchParams }); }
async function CachedContent({ searchParams }: { searchParams: ReportSearchParams }) {
  "use cache: private";
  cacheLife({ stale: 30 });cacheTag("portal:reports");
  const { branches, access } = await getMigrationReportingContext();
  const parsed = parseReportFilters(searchParams, analyticsToday(new Date()));
  if (parsed.values.branch && !branches.some(branch => branch.id === parsed.values.branch)) redirect("/access-denied");
  let data: MigrationAnalytics | null = null, error = parsed.error;
  if (parsed.request) {
    try { data = await getMigrationAnalytics(parsed.request); }
    catch { error = "Migration analytics could not be loaded. Check that the migration has been applied and try again."; }
  }
  const range = parsed.request ? resolveAnalyticsDateRange(parsed.request.range) : null;
  return <PageContainer>
    <PageHeader title="Member Migration" backHref="/portal/reports" backLabel="Back to Reports"
      description="New branch transfers, departures from the church, and returns. Inactivity and ordinary archives are not departures."
      action={hasPermission(access.permissions, "members.view") ? <Link className="text-sm font-medium text-[#365FA6] hover:underline" href="/portal/members/migrations">View movement records</Link> : undefined} />
    <ReportFilters key={JSON.stringify(parsed.values)} action="/portal/reports/migrations" values={parsed.values} branches={branches.map(branch => ({ ...branch, inactivityThresholdWeeks: 0 }))} />
    {error ? <FeedbackMessage>{error}</FeedbackMessage> : data && <>
      <p className="text-sm text-slate-600">Tracking started {formatManilaTimestamp(data.trackingStartedAt)}. Earlier movements are unknown and are not backfilled. Dates use Asia/Manila.</p>
      {range && range.from <= (manilaDateFromTimestamp(data.trackingStartedAt) ?? "") && <FeedbackMessage variant="warning">This date range includes time before tracking began. Totals cover recorded movements only.</FeedbackMessage>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Transfer Events", data.totals.transfers], ["Distinct Members Moved", data.totals.members],
          ["Transfers In", data.totals.incoming], ["Transfers Out", data.totals.outgoing],
          ["Departures", data.totals.departures], ["Returns", data.totals.returns], ["Net Movement", data.totals.net],
        ].map(([label,value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[#203264]">{Number(value).toLocaleString("en-PH")}</p></CardContent></Card>)}
      </div>
      <p className="text-xs text-slate-500">A member can move multiple times. Transfers within the selected branches count once as an event, once in, and once out. Net movement = transfers in + returns − transfers out − departures; it is not total membership growth.</p>
      <ReportChart title="Member Movement Over Time" kind="bar" labels={data.trend.map(point => point.periodStart)}
        series={([ ["Transfers In", "incoming", "#16836B"], ["Transfers Out", "outgoing", "#365FA6"], ["Departures", "departures", "#B7791F"], ["Returns", "returns", "#8B5CB5"] ] as const).map(([label,key,color]) => ({ label, color, values: data!.trend.map(point => point[key]) }))}
        emptyMessage="No recorded movements match this branch and date range." />
      <section className="space-y-3"><h2 className="text-lg font-semibold text-[#203264]">Movement by Branch</h2>
        <Table><TableHeader><TableRow>{["Branch","Transfers In","Transfers Out","Departures","Returns","Net"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{data.branches.map(branch => <TableRow key={branch.id}><TableCell>{branch.name}</TableCell>{[branch.incoming,branch.outgoing,branch.departures,branch.returns,branch.net].map((value,index) => <TableCell key={index}>{value}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold text-[#203264]">Transfer Routes</h2>
        <Table><TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Transfers</TableHead></TableRow></TableHeader>
          <TableBody>{data.flows.length ? data.flows.map((flow,index) => <TableRow key={index}><TableCell>{flow.source}</TableCell><TableCell>{flow.destination}</TableCell><TableCell>{flow.transfers}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3}>No transfers in this selection.</TableCell></TableRow>}</TableBody>
        </Table>
      </section>
    </>}
  </PageContainer>;
}
