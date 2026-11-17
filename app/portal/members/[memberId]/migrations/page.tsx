import { memberHistoryNavigation } from "@/lib/member-history-navigation";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { getMemberMigrationHistory } from "@/lib/member-migrations/server";
import { MigrationHistoryTable } from "../../MigrationHistoryTable";

type Props = { params: Promise<{ memberId: string }>; searchParams: Promise<{ page?: string; returnTo?: string | string[] }> };
export default function MigrationHistoryPage(props: Props) { return <Suspense fallback={<PageSkeleton kind="table" label="migration history" />}><Content {...props} /></Suspense>; }
async function Content({ params, searchParams }: Props) { const query = await searchParams; return CachedContent({ memberId: (await params).memberId, page: Number(query.page) || 1, returnTo: query.returnTo }); }
async function CachedContent({ memberId, page, returnTo }: { memberId: string; page: number; returnTo?: string | string[] }) {
  "use cache: private";
  cacheLife({ stale: 30 });cacheTag("portal:members");
  const navigation = memberHistoryNavigation(memberId, returnTo, "/portal/members/migrations", "Back to Migration Records");
  const result = await getMemberMigrationHistory(memberId, page);
  return <PageContainer><PageHeader title="Member Migration History" backHref={navigation.backHref} backLabel={navigation.backLabel} description="Recorded movements involving your accessible branches. History stays with the event even when the member moves again. No earlier movements are inferred." />
    <MigrationHistoryTable rows={result.rows} />
    <Pagination label="Migration history pagination" page={result.page} pageSize={10} total={result.total} noun="movements" hrefForPage={navigation.pageHref} />
  </PageContainer>;
}
