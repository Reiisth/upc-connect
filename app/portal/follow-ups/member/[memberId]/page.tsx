import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardPen, Handshake, MapPin, MessageSquare, MoreHorizontal, Pencil, Phone, Plus, UserRoundCog } from "lucide-react";
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
import { formatAttendanceDate, getAttendanceFlag } from "@/lib/inactivity/presentation";
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
  const status = summary ? getAttendanceFlag(summary) : null;

  return <PageContainer>
    <PageHeader backHref="/portal/follow-ups" backLabel="Back to Follow-ups" eyebrow="Follow-ups" eyebrowIcon={<ClipboardPen className="h-4 w-4" />} title="Follow-up History"
      description="Recorded staff actions, newest first. History stays with its original branch after a member transfers."
      action={<>
        {hasPermission(access.permissions, "members.view") && member.branchId && access.branchIds.includes(member.branchId) && <Button asChild variant="outline"><Link href={`/portal/members/${member.id}`}>Open Member</Link></Button>}
        {hasPermission(access.permissions, "members.update") && member.branchId && access.branchIds.includes(member.branchId) && <Button asChild variant="outline"><Link href={`/portal/members/${member.id}/edit`}><UserRoundCog />Review Member Status</Link></Button>}
        {canCreate ? <Button asChild><Link href={`/portal/follow-ups/new?memberId=${member.id}&branchId=${member.branchId}`}><Plus />Record Follow-up</Link></Button> : undefined}
      </>} />
    {(await searchParams).saved === "1" && <p role="status" className="text-sm text-emerald-700">Follow-up saved successfully.</p>}
    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          {hasPermission(access.permissions, "members.view") && member.branchId && access.branchIds.includes(member.branchId) &&
            <span tabIndex={0} aria-label={`Member status: ${member.memberStatus ?? "unknown"}`}
              className={`group inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${member.memberStatus === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
              <span className="h-3 w-3 rounded-full" aria-hidden="true" />
              <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">
                {member.memberStatus === "active" ? "Active" : member.memberStatus === "inactive" ? "Inactive" : "Unknown"}
              </span>
            </span>}
          <h2 className="font-radio-canada text-2xl font-semibold text-[#203264] sm:text-3xl">{member.name}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">{currentBranch?.name ?? "Outside your branch access"}{member.isArchived ? " - Archived member" : ""}</p>
      </div>
      {summary ? <>
        <StatusBadge variant={status === "needs_follow_up" ? "warning" : status === "monitoring" ? "success" : "muted"}>{status === "needs_follow_up" ? "Needs Follow-up" : status === "monitoring" ? "Monitoring" : "Unknown"}</StatusBadge>
        <div className="grid grid-cols-2 gap-5 border-t pt-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Consecutive absences</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-[#203264] sm:text-5xl">{summary.consecutiveAbsentWeeks ?? "--"}<span className="ml-2 text-lg font-medium text-slate-400">/ {summary.inactivityThresholdWeeks}</span></p>
            <p className="mt-2 text-xs text-slate-500">{summary.consecutiveAbsentWeeks === null ? "Missing or invalid registration date" : "Eligible absent weeks / branch threshold"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Present rate</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-[#203264] sm:text-5xl">{summary.recentAttendanceRate === null ? "--" : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(summary.recentAttendanceRate)}%`}</p>
            <p className="mt-2 text-xs text-slate-500">{summary.recentAttendedWeeks} of {summary.recentEligibleWeeks} recent eligible weeks</p>
          </div>
        </div>
      </> : <p className="text-sm text-slate-500">A current attendance flag is unavailable for this member or your access.</p>}
    </CardContent></Card>

    {!history.length ? <EmptyState title="No follow-ups recorded" description="No historical follow-up actions are visible for this member within your branch access." /> :
      <section aria-label="Chronological follow-up history" className="space-y-3">{history.map((row) => {
        const MethodIcon = { call: Phone, message: MessageSquare, visit: MapPin, in_person: Handshake, other: MoreHorizontal }[row.method];
        return <Card key={row.id}>
        <CardHeader className="p-4 pb-2"><div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />{formatAttendanceDate(row.followUpDate)}</span><span className="inline-flex items-center gap-1.5 font-medium"><MethodIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />{METHOD_LABELS[row.method]}</span></CardTitle>
          <div className="flex items-center gap-3"><FollowUpOutcomeBadge outcome={row.outcome} />
            {hasPermission(access.permissions, "follow_ups.update") && row.branchIsActive && <TableActionButton href={`/portal/follow-ups/${row.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
          </div>
        </div></CardHeader>
        <CardContent className="space-y-2 p-4 pt-0 text-sm text-slate-600">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><p>Branch: {row.branchName}</p><p>Followed up by: {row.performerName || "Not specified / account removed"}</p><p>Next follow-up: {formatAttendanceDate(row.nextFollowUpDate)}</p></div>
          <p className="whitespace-pre-wrap break-words">{row.notes || "No notes recorded."}</p>
        </CardContent>
      </Card>; })}</section>}
  </PageContainer>;
}
