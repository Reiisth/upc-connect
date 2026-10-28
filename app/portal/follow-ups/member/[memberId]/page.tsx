import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionButton } from "@/components/ui/table-action-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { getBranchMemberInactivity } from "@/lib/inactivity/server";
import { formatAttendanceDate, formatRecentRate, getDerivedStatus } from "@/lib/inactivity/presentation";
import { requireFollowUpsPermission } from "../../access";
import { loadFollowUpBranches, loadFollowUpMember, loadFollowUpRecords } from "../../data";
import { FollowUpOutcomeBadge } from "../../FollowUpOutcomeBadge";
import { isUuid, METHOD_LABELS } from "../../types";
import FollowUpsLoading from "../../loading";

type Props = { params: Promise<{ memberId: string }>; searchParams: Promise<{ saved?: string }> };
export default function MemberFollowUpPage(props: Props) {
  return <Suspense fallback={<FollowUpsLoading />}><MemberFollowUpContent {...props} /></Suspense>;
}
async function MemberFollowUpContent({ params, searchParams }: Props) {
  const access = await requireFollowUpsPermission("follow_ups.view");
  const { memberId } = await params;
  if (!isUuid(memberId)) notFound();
  const admin = createAdminClient();
  const [branches, history] = await Promise.all([loadFollowUpBranches(access, admin), loadFollowUpRecords(access, admin, memberId)]);
  const member = await loadFollowUpMember(access, admin, memberId, history);
  if (!member) notFound();
  const currentBranch = branches.find((branch) => branch.id === member.branchId);
  const canCreate = hasPermission(access.permissions, "follow_ups.create") && Boolean(currentBranch?.isActive);
  const summary = hasPermission(access.permissions, "inactivity.view") && currentBranch?.isActive && !member.isArchived
    ? (await getBranchMemberInactivity(currentBranch.id)).find((row) => row.memberId === member.id) : null;
  const status = summary ? getDerivedStatus(summary) : null;

  return <PageContainer>
    <PageHeader backHref="/portal/follow-ups" backLabel="Back to Follow-ups" title={`${member.name} — Follow-up History`}
      description="Recorded staff actions, newest first. History stays with its original branch after a member transfers."
      action={canCreate ? <Button asChild><Link href={`/portal/follow-ups/new?memberId=${member.id}&branchId=${member.branchId}`}><Plus />Record Follow-up</Link></Button> : undefined} />
    {(await searchParams).saved === "1" && <p role="status" className="text-sm text-emerald-700">Follow-up saved successfully.</p>}
    <Card><CardContent className="space-y-3 p-5">
      <p className="text-sm text-slate-600">Current branch: {currentBranch?.name ?? "Outside your branch access"}{member.isArchived ? " · Archived member" : ""}</p>
      {summary ? <div className="space-y-2 text-sm text-slate-600">
        <p className="flex flex-wrap items-center gap-2">Current derived inactivity: <StatusBadge variant={status === "inactive" ? "danger" : status === "active" ? "success" : "muted"}>{status === "inactive" ? "Inactive" : status === "active" ? "Active" : "Unknown"}</StatusBadge></p>
        <p>{summary.consecutiveAbsentWeeks === null ? "Missing or invalid first attendance date" : `${summary.consecutiveAbsentWeeks} / ${summary.inactivityThresholdWeeks} consecutive absent weeks`} · Recent weekly rate: {formatRecentRate(summary)}</p>
      </div> : <p className="text-sm text-slate-500">A current inactivity summary is unavailable for this member or your access.</p>}
      <p className="text-xs text-slate-500">Follow-up outcomes do not change attendance, member status or the absence streak.</p>
    </CardContent></Card>

    {!history.length ? <EmptyState title="No follow-ups recorded" description="No historical follow-up actions are visible for this member within your branch access." /> :
      <section aria-label="Chronological follow-up history" className="space-y-4">{history.map((row) => <Card key={row.id}>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{formatAttendanceDate(row.followUpDate)} · {METHOD_LABELS[row.method]}</CardTitle>
          <div className="flex items-center gap-3"><FollowUpOutcomeBadge outcome={row.outcome} />
            {hasPermission(access.permissions, "follow_ups.update") && row.branchIsActive && <TableActionButton href={`/portal/follow-ups/${row.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
          </div>
        </div></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="grid gap-2 sm:grid-cols-3"><p>Branch: {row.branchName}</p><p>Followed up by: {row.performerName || "Not specified / account removed"}</p><p>Next follow-up: {formatAttendanceDate(row.nextFollowUpDate)}</p></div>
          <p className="whitespace-pre-wrap break-words">{row.notes || "No notes recorded."}</p>
        </CardContent>
      </Card>)}</section>}
  </PageContainer>;
}
