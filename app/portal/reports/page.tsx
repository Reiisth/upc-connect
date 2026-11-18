import { getPortalBranchId } from "@/lib/portal-branch-server";
import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { analyticsToday, validAnalyticsDate, resolveAnalyticsDateRange } from "@/lib/analytics/date-range";
import { getAnalyticsBranchOptions, getAnalyticsOverview } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMigrationAnalytics, type MigrationAnalytics } from "@/lib/member-migrations/server";
import type { AnalyticsOverview } from "@/lib/analytics/types";
import { parseReportFilters, reportFilterUrl, type ReportSearchParams } from "./filters";
import ReportsDashboard from "./ReportsDashboard";
import ReportsView from "./ReportsView";

export const metadata = { title: "Dashboard | UPC Connect" };

type PageProps = { searchParams: Promise<ReportSearchParams> };
export default function ReportsPage(props: PageProps) {
  return <Suspense fallback={<PageSkeleton showHeader={false} kind="dashboard" fields={6} metrics={4} columns={5} label="dashboard" />}><ReportsContent {...props} /></Suspense>;
}

async function ReportsContent({ searchParams }: PageProps) {
  return CachedReportsContent({ searchParams: await searchParams });
}

async function CachedReportsContent({ searchParams }: { searchParams: ReportSearchParams }) {
  "use cache: private";
  cacheLife({ stale: 30 });
  cacheTag("portal:reports");
  // This read requires reports.view before accessing request filters or branch metadata.
  // Its request-scoped context is reused by getAnalyticsOverview below.
  const branches = await getAnalyticsBranchOptions();
  const parsed = parseReportFilters({...searchParams,branch: (await getPortalBranchId()) ?? ""}, analyticsToday(new Date()));
  if (parsed.values.branch && !branches.some((branch) => branch.id === parsed.values.branch)) redirect("/access-denied");
  let overview: AnalyticsOverview | null = null;
  let previous: AnalyticsOverview | null = null;
  let migration: MigrationAnalytics | null = null;
  let serviceTypeNames: Record<string, string> = {};
  let loadFailed = false;
  if (parsed.request && branches.length) {
    const range = resolveAnalyticsDateRange(parsed.request.range, analyticsToday(new Date()));
    const start = Date.parse(`${range.from}T00:00:00Z`);
    const duration = Date.parse(`${range.to}T00:00:00Z`) - start + 86400000;
    const from = new Date(start - duration).toISOString().slice(0, 10);
    const to = new Date(start - 86400000).toISOString().slice(0, 10);
    const [currentResult, previousResult, typesResult, migrationResult] = await Promise.allSettled([
      getAnalyticsOverview(parsed.request),
      validAnalyticsDate(from) && validAnalyticsDate(to)
        ? getAnalyticsOverview({ ...parsed.request, range: { preset: "custom", from, to } })
        : Promise.resolve(null),
      createAdminClient().from("service_types").select("key,name"),
      getMigrationAnalytics({ ...parsed.request, range: { preset: "custom", from: range.from, to: range.to } }),
    ]);
    if (currentResult.status === "fulfilled") overview = currentResult.value;
    else loadFailed = true;
    if (previousResult.status === "fulfilled") previous = previousResult.value;
    if (typesResult.status === "fulfilled") serviceTypeNames = Object.fromEntries((typesResult.value.data ?? []).map(row => [row.key, row.name]));
    if (migrationResult.status === "fulfilled") migration = migrationResult.value;
  }
  return <PageContainer className="min-w-0">
    <PageHeader variant="overview" title="Dashboard"
       />
    <ReportsView key={reportFilterUrl(parsed.values)} branches={branches} values={parsed.values}
      insightFilters={overview && parsed.request ? {
        ...(parsed.request.branchId ? { branchId: parsed.request.branchId } : {}),
        range: { preset: "custom", from: overview.range.from, to: overview.range.to }, grouping: overview.grouping,
      } : null}>
    {parsed.error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Check your dashboard filters</p><p className="mt-1">{parsed.error}</p>
    </div> : loadFailed ? <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6">
      <div className="flex items-center gap-2 font-semibold text-red-700"><CircleAlert className="h-5 w-5" aria-hidden="true" />Dashboard could not be loaded</div>
      <p className="mt-2 text-sm text-slate-600">Your data could not be retrieved. Try again or choose another filter.</p>
      <Button asChild variant="outline" className="mt-4"><a href={reportFilterUrl(parsed.values)}>Try again</a></Button>
    </div> : !branches.length ? <EmptyState title="No branch access" description="Your account has no accessible branches for reporting." /> :
      overview && <ReportsDashboard overview={overview} previous={previous} serviceTypeNames={serviceTypeNames} migration={migration} />}
    </ReportsView>
  </PageContainer>;
}
