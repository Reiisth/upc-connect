import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, ClipboardPen, HeartPulse, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermission } from "@/lib/permissions";
import { requireStaffMember } from "../data";
import { MemberArchiveControl } from "../MemberArchiveControl";
import { loadMemberAccountEmail } from "../account-email";

export default function MemberPage(props: { params: Promise<{ memberId: string }> }) {
  return <Suspense fallback={<MemberDetailLoading />}><Content {...props} /></Suspense>;
}

async function Content({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { member, access, admin } = await requireStaffMember(memberId, "members.view");
  const can = (permission: typeof access.permissions[number]) => hasPermission(access.permissions, permission);
  const [{ data: branch }, { data: department }] = await Promise.all([
    member.church_branch_id ? admin.from("church_branches").select("name").eq("id", member.church_branch_id).maybeSingle() : Promise.resolve({ data: null }),
    member.department_id ? admin.from("departments").select("name").eq("id", member.department_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const account = await loadMemberAccountEmail(admin, memberId);

  const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
  const accountStatus = member.account_status === "connected" ? "Connected" : member.account_status === "invited" ? "Invited" : "No Account";
  const profileStatus = member.profile_status === "completed" ? "Complete" : "Incomplete";
  const address = [member.street_address, member.barangay, member.city, member.province, member.country].filter(Boolean).join(", ");
  const editHref = `/portal/members/${memberId}/edit`;

  return <PageContainer className="max-w-5xl">
    <PageHeader
      eyebrow="Member Record"
      eyebrowIcon={<UsersRound className="h-4 w-4" />}
      title={fullName}
      description={member.is_archived ? "Archived member record" : "Member identity and church information"}
      backHref="/portal/members"
      backLabel="Back to Members"
      action={<div className="flex flex-wrap gap-2">
        {!member.is_archived && can("members.update") && <Button asChild><Link href={editHref}>Edit Member</Link></Button>}
        {member.account_status === "no_account" && !member.is_archived && can("members.link_account") &&
          <Button variant="outline" asChild><Link href={`/portal/members/invite?memberId=${memberId}`}>Connect Account</Link></Button>}
        {account && can("accounts.view") &&
          <Button variant="outline" asChild><Link href={`/portal/accounts/${account.userId}`}>Manage Account</Link></Button>}
      </div>}
    />

    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[#203264]">Church Information</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge variant={member.member_status === "active" ? "success" : "muted"}>Member Status: {member.member_status === "active" ? "Active" : "Inactive"}</StatusBadge>
            {member.is_archived && <StatusBadge variant="muted">Archived</StatusBadge>}
          </div>
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Church Branch" value={branch?.name ?? "Not assigned"} />
          <Info label="First Attendance (Historical)" value={member.first_attendance_date ?? "Unknown"} />
          <Info label="Department" value={department?.name ?? "Not assigned"} />
          <Info label="Position" value={member.position ?? "Not provided"} />
          <Info label="Zone" value={member.zone == null ? "Not assigned" : String(member.zone)} />
        </dl>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[#203264]">Account</h2>
          <StatusBadge variant={member.account_status === "connected" ? "success" : member.account_status === "invited" ? "warning" : "muted"}>{accountStatus}</StatusBadge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Profile completion:</span>
          <StatusBadge variant={member.profile_status === "completed" ? "info" : "muted"}>{profileStatus}</StatusBadge>
        </div>
        <p className="mt-3 break-all text-sm text-slate-600">Account Email: {account ? account.email ?? "No email available" : "No linked account"}</p>
        {member.account_status === "invited" && <p className="mt-3 text-sm text-slate-600">The invitation is pending.</p>}
        {member.account_status === "no_account" && <p className="mt-3 text-sm text-slate-600">No account is connected to this member.</p>}
      </CardContent>
    </Card>

    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="font-semibold text-[#203264]">Personal Information</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Info label="Phone" value={member.phone_number ?? "Not provided"} />
          <Info label="Birthday" value={member.birth_date ?? "Not provided"} />
          <Info label="Gender" value={member.gender ?? "Not provided"} />
          <Info label="Address" value={address || "Not provided"} className="sm:col-span-2" />
        </dl>
      </CardContent>
    </Card>

    {(can("inactivity.view") || can("follow_ups.view") || can("follow_ups.create")) && <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="font-semibold text-[#203264]">Care and Activity</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {can("inactivity.view") && <Button variant="outline" asChild><Link href="/portal/inactivity"><HeartPulse />View Attendance Flag</Link></Button>}
          {can("follow_ups.view") && <Button variant="outline" asChild><Link href={`/portal/follow-ups/member/${memberId}`}><ClipboardPen />Follow-up History</Link></Button>}
          {can("follow_ups.create") && <Button variant="outline" asChild><Link href={`/portal/follow-ups/new?memberId=${memberId}`}><ArrowUpRight />Record Follow-up</Link></Button>}
        </div>
      </CardContent>
    </Card>}

    {can("members.archive") && <section className="border-t border-slate-200 pt-5">
      <h2 className="text-sm font-semibold text-slate-700">Member Record Actions</h2>
      <p className="mt-1 mb-3 text-sm text-slate-500">Archiving a member does not archive the linked account.</p>
      <MemberArchiveControl memberId={memberId} memberName={fullName} archived={member.is_archived} />
    </section>}
  </PageContainer>;
}

function Info({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>;
}

function MemberDetailLoading() {
  return <div className="space-y-5"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>;
}
