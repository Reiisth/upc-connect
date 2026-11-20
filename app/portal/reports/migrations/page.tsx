import { getPortalBranchId } from "@/lib/portal-branch-server";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { analyticsToday, resolveAnalyticsDateRange } from "@/lib/analytics/date-range";
import { getMigrationAnalytics, getMigrationReportingContext, type MigrationAnalytics } from "@/lib/member-migrations/server";
import { hasPermission } from "@/lib/permissions";
import ReportFilters from "../ReportFilters";
import MigrationAnalyticsPanel from "../MigrationAnalyticsPanel";
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
  const parsed = parseReportFilters({...searchParams,branch: (await getPortalBranchId()) ?? ""}, analyticsToday(new Date()));
  if (parsed.values.branch && !branches.some(branch => branch.id === parsed.values.branch)) redirect("/access-denied");
  let data: MigrationAnalytics | null = null, error = parsed.error;
  if (parsed.request) {
    try { data = await getMigrationAnalytics(parsed.request); }
    catch { error = "Migration analytics could not be loaded. Check that the migration has been applied and try again."; }
  }
  const range = parsed.request ? resolveAnalyticsDateRange(parsed.request.range) : null;
  return <PageContainer>
    <PageHeader title="Member Migration" backHref="/portal/reports" backLabel="Back to Dashboard"
      description="New branch transfers, departures from the church, and returns. Inactivity and ordinary archives are not departures."
      action={hasPermission(access.permissions, "members.view") ? <Link className="text-sm font-medium text-[#365FA6] hover:underline" href="/portal/members/migrations">View movement records</Link> : undefined} />
    <ReportFilters key={JSON.stringify(parsed.values)} action="/portal/reports/migrations" values={parsed.values} branches={branches.map(branch => ({ ...branch, inactivityThresholdWeeks: 0 }))} />
    {error ? <FeedbackMessage>{error}</FeedbackMessage> : data && range && <MigrationAnalyticsPanel data={data} range={range} grouping={parsed.request?.grouping} />}
  </PageContainer>;
}
