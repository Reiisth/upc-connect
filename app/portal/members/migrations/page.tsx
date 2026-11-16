import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TableToolbar, SearchInput } from "@/components/ui/table-toolbar";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { requireMembersPermission } from "../access";
import { getHistoricalRecordBranches } from "@/lib/historical-records";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMigrationEvents } from "@/lib/member-migrations/server";
import { hasPermission } from "@/lib/permissions";
import { MigrationHistoryTable } from "../MigrationHistoryTable";

type Search = Record<string,string | string[] | undefined>;
export default function MigrationRecordsPage(props: { searchParams: Promise<Search> }) { return <Suspense fallback={<PageSkeleton kind="table" label="migration records" />}><Content {...props} /></Suspense>; }
async function Content({ searchParams }: { searchParams: Promise<Search> }) { return CachedContent({ searchParams: await searchParams }); }
async function CachedContent({ searchParams }: { searchParams: Search }) {
  "use cache: private";
  cacheLife({ stale: 30 });cacheTag("portal:members");
  const access = await requireMembersPermission("members.view");
  const branches = await getHistoricalRecordBranches(access,createAdminClient());
  const text = (key: string) => typeof searchParams[key] === "string" ? searchParams[key] as string : "";
  const filters = { search: text("search").slice(0,100), branch: text("branch"), kind: text("kind"), from: text("from"), to: text("to"), page: Number(text("page")) || 1 };
  let result: Awaited<ReturnType<typeof getMigrationEvents>> | null = null, error = "";
  try { result = await getMigrationEvents(filters); } catch (failure) { error = failure instanceof Error ? failure.message : "Movement records could not be loaded."; }
  function href(page: number) { const query = new URLSearchParams();for (const [key,value] of Object.entries(filters)) if (value && key !== "page") query.set(key,String(value));query.set("page",String(page));return `/portal/members/migrations?${query}`; }
  return <PageContainer><PageHeader title="Migration Records" backHref="/portal/members" backLabel="Back to Members" description="Automatically recorded transfers, departures and returns involving your branches. Dates reflect when changes were saved, not historical effective dates."
    action={hasPermission(access.permissions,"reports.view") ? <Button variant="outline" asChild><Link href="/portal/reports/migrations">Migration Analytics</Link></Button> : undefined} />
    <form action="/portal/members/migrations" method="get" className="space-y-3">
      <TableToolbar><SearchInput name="search" aria-label="Search movement records by member" placeholder="Search member name at movement..." defaultValue={filters.search} />
        <Select name="branch" aria-label="Filter movement records by branch" defaultValue={filters.branch}><option value="">All accessible branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>
        <Select name="kind" aria-label="Filter movement type" defaultValue={filters.kind}><option value="">All movements</option><option value="transfer">Transfers</option><option value="departure">Departures</option><option value="return">Returns</option></Select>
      </TableToolbar>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><FormField label="From" htmlFor="movement-from"><Input id="movement-from" type="date" name="from" defaultValue={filters.from} /></FormField><FormField label="To" htmlFor="movement-to"><Input id="movement-to" type="date" name="to" defaultValue={filters.to} /></FormField><Button type="submit">Apply filters</Button><Button variant="ghost" asChild><Link href="/portal/members/migrations">Clear filters</Link></Button></div>
    </form>
    {error ? <FeedbackMessage>{error}</FeedbackMessage> : result && <><MigrationHistoryTable rows={result.rows} showMember /><Pagination label="Migration records pagination" page={result.page} pageSize={10} total={result.total} noun="movements" hrefForPage={href} /></>}
  </PageContainer>;
}
