import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Activity, CircleAlert, CircleCheck, CircleHelp, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { getBranchMemberInactivity, getInactivityBranchOptions } from "@/lib/inactivity/server";
import { getMonitoringCounts } from "@/lib/inactivity/presentation";
import InactivityTable from "./InactivityTable";
import ThresholdSettings from "./ThresholdSettings";
import InactivityLoading from "./loading";

type PageProps = { searchParams: Promise<{ branch?: string | string[] }> };

export default function InactivityPage(props: PageProps) {
  return <Suspense fallback={<InactivityLoading />}><InactivityContent {...props} /></Suspense>;
}

async function InactivityContent({ searchParams }: PageProps) {
  const { branches, canManageSettings, canCreateFollowUps, canViewFollowUps } = await getInactivityBranchOptions();
  const params = await searchParams;
  const requestedBranch = Array.isArray(params.branch) ? params.branch[0] : params.branch;
  const branch = requestedBranch ? branches.find((item) => item.id === requestedBranch) : branches[0];
  if (requestedBranch && !branch) redirect("/access-denied");
  const rows = branch ? await getBranchMemberInactivity(branch.id) : [];
  const counts = getMonitoringCounts(rows);

  return (
    <PageContainer>
      <PageHeader eyebrow="Attendance" eyebrowIcon={<Activity className="h-4 w-4" />}
        title="Inactivity Monitoring"
        description="Weekly attendance results calculated from completed services. These results are separate from stored member statuses." />

      {!branch ? (
        <EmptyState icon={<Activity className="h-5 w-5" />} title="No active branch access"
          description="There are no active church branches available to your account for inactivity monitoring." />
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Branch Overview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {branches.length > 1 ? (
                  <form action="/portal/inactivity" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <FormField label="Branch" htmlFor="inactivity-branch" className="flex-1">
                      <Select key={branch.id} id="inactivity-branch" name="branch" defaultValue={branch.id}>
                        {branches.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}
                      </Select>
                    </FormField>
                    <Button type="submit" variant="outline">View branch</Button>
                  </form>
                ) : (
                  <p className="font-medium text-slate-900">{branch.name}{branch.code ? ` (${branch.code})` : ""}</p>
                )}
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Weeks run Monday–Sunday in Asia/Manila. Only finished weeks with completed services count; weeks without them are ignored.</p>
                  <p>One present or late attendance makes a week present. Excused records do not count as physical attendance. This unfinished week cannot add an absence.</p>
                </div>
              </CardContent>
            </Card>
            <ThresholdSettings key={branch.id} branch={branch} canManage={canManageSettings} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Selected branch monitoring totals">
            {[
              { label: "Total Monitored", value: counts.total, icon: UsersRound, note: "Non-archived branch members" },
              { label: "Derived Active", value: counts.active, icon: CircleCheck, note: "Below the weekly absence threshold" },
              { label: "Derived Inactive", value: counts.inactive, icon: CircleAlert, note: "At or above the weekly absence threshold" },
              { label: "Unknown", value: counts.unknown, icon: CircleHelp, note: "Missing or invalid attendance start date" },
            ].map(({ label, value, icon: Icon, note }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                    <Icon className="h-5 w-5 shrink-0 text-[#5D94E8]" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-[#203264]">{value.toLocaleString("en-PH")}</p>
                  <p className="mt-2 text-xs text-slate-500">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <InactivityTable key={branch.id} rows={rows} canCreateFollowUps={canCreateFollowUps} canViewFollowUps={canViewFollowUps} />
        </>
      )}
    </PageContainer>
  );
}
