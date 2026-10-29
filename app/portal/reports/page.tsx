import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { analyticsToday } from "@/lib/analytics/date-range";
import { getAnalyticsBranchOptions, getAnalyticsOverview } from "@/lib/analytics/server";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { parseReportFilters, reportFilterUrl, type ReportSearchParams } from "./filters";
import ReportFilters from "./ReportFilters";
import ReportsDashboard from "./ReportsDashboard";
import ReportsLoading from "./loading";

type PageProps = { searchParams: Promise<ReportSearchParams> };
export default function ReportsPage(props: PageProps) {
  return <Suspense fallback={<ReportsLoading />}><ReportsContent {...props} /></Suspense>;
}

async function ReportsContent({ searchParams }: PageProps) {
  // This read requires reports.view before accessing request filters or branch metadata.
  // Its request-scoped context is reused by getAnalyticsOverview below.
  const branches = await getAnalyticsBranchOptions();
  const parsed = parseReportFilters(await searchParams, analyticsToday(new Date()));
  if (parsed.values.branch && !branches.some((branch) => branch.id === parsed.values.branch)) redirect("/access-denied");
  let overview: AnalyticsOverview | null = null;
  let loadFailed = false;
  if (parsed.request && branches.length) {
    try { overview = await getAnalyticsOverview(parsed.request); }
    catch { loadFailed = true; }
  }
  return <PageContainer className="min-w-0">
    <PageHeader eyebrow="Insights" eyebrowIcon={<ChartNoAxesCombined className="h-4 w-4" />} title="Reports & Analytics"
      description="Membership, attendance, member care, and giving across your accessible branches." />
    <ReportFilters key={reportFilterUrl(parsed.values)} branches={branches} values={parsed.values} />
    {parsed.error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Check your report filters</p><p className="mt-1">{parsed.error}</p>
    </div> : loadFailed ? <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6">
      <div className="flex items-center gap-2 font-semibold text-red-700"><CircleAlert className="h-5 w-5" aria-hidden="true" />Reports could not be loaded</div>
      <p className="mt-2 text-sm text-slate-600">Your data could not be retrieved. Try again or choose another filter.</p>
      <Button asChild variant="outline" className="mt-4"><a href={reportFilterUrl(parsed.values)}>Try again</a></Button>
    </div> : !branches.length ? <EmptyState title="No branch access" description="Your account has no accessible branches for reporting." /> :
      overview && <ReportsDashboard overview={overview} />}
  </PageContainer>;
}
