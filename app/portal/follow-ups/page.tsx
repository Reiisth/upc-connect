import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import { ClipboardPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { manilaDate } from "@/lib/inactivity/calculate";
import { requireFollowUpsPermission } from "./access";
import { loadFollowUpBranches, loadFollowUpRecords } from "./data";
import FollowUpsTable from "./FollowUpsTable";

export default function FollowUpsPage() {
  return <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="follow ups" />}><FollowUpsContent /></Suspense>;
}
async function FollowUpsContent() {
  "use cache: private";
  cacheLife({ stale: 30 });
  cacheTag("portal:follow-ups");
  const access = await requireFollowUpsPermission("follow_ups.view");
  const admin = createAdminClient();
  const [branches, rows] = await Promise.all([loadFollowUpBranches(access, admin), loadFollowUpRecords(access, admin)]);
  return <PageContainer>
    <PageHeader eyebrow="Member Care" eyebrowIcon={<ClipboardPen className="h-4 w-4" />} title="Follow-ups"
      description="Historical staff actions and next contact dates. Outcomes remain separate from attendance-based inactivity."
      action={hasPermission(access.permissions, "follow_ups.create") && branches.some((b) => b.isActive) ? <Button asChild><Link href="/portal/follow-ups/new"><Plus />Record Follow-up</Link></Button> : undefined} />
    {!branches.length ? <EmptyState title="No branch access" description="Your account has no accessible branches for follow-up history." /> :
      <FollowUpsTable rows={rows} branches={branches} today={manilaDate(new Date())} canUpdate={hasPermission(access.permissions, "follow_ups.update")} />}
  </PageContainer>;
}
