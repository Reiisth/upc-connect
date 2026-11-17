import { selectPortalBranches } from "@/lib/portal-branch-server";
import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { getBranchMemberInactivity, getInactivityBranchOptions } from "@/lib/inactivity/server";

import InactivityTable from "./InactivityTable";
import ThresholdSettings from "./ThresholdSettings";

type PageProps = { searchParams: Promise<{ branch?: string | string[] }> };

export default function InactivityPage(props: PageProps) {
  return <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={2} columns={5} label="inactivity" />}><InactivityContent {...props} /></Suspense>;
}

async function InactivityContent({ searchParams }: PageProps) {
  await searchParams;
  return CachedInactivityContent();
}

async function CachedInactivityContent() {
  "use cache: private";
  cacheLife({ stale: 30 });
  cacheTag("portal:inactivity");
  const { branches: availableBranches, canManageSettings, canCreateFollowUps, canViewFollowUps, canViewMemberStatus, canUpdateMemberStatus } = await getInactivityBranchOptions();
  const branches = await selectPortalBranches(availableBranches);
  const rows = (await Promise.all(branches.map(branch => getBranchMemberInactivity(branch.id)))).flat();


  return (
    <PageContainer>
      <PageHeader eyebrow="Attendance" eyebrowIcon={<Activity className="h-4 w-4" />}
        title="Attendance Follow-up Monitoring"
        description="Attendance monitoring begins when the Member is registered in UPC Connect. Weekly flags help staff identify members for human follow-up and never change administrative Member Status." />

      {!branches.length ? (
        <EmptyState icon={<Activity className="h-5 w-5" />} title="No active branch access"
          description="There are no active church branches available to your account for inactivity monitoring." />
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Branch Overview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="font-medium text-slate-900">{branches.length === 1 ? branches[0].name : "All accessible branches"}</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Weeks run Monday–Sunday in Asia/Manila. Only finished weeks with completed services count; weeks without them are ignored.</p>
                  <p>One Present attendance makes a week present. A home-branch Excused week is excluded from the absence count, not counted as physical attendance. This unfinished week cannot add an absence.</p>
                </div>
              </CardContent>
            </Card>
            {branches.map(branch => <ThresholdSettings key={branch.id} branch={branch} canManage={canManageSettings} />)}
          </div>

          <InactivityTable rows={rows} canCreateFollowUps={canCreateFollowUps} canViewFollowUps={canViewFollowUps} canViewMemberStatus={canViewMemberStatus} canUpdateMemberStatus={canUpdateMemberStatus} />
        </>
      )}
    </PageContainer>
  );
}
