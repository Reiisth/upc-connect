import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, ClipboardPen, HeartPulse, HandCoins, Droplets, UsersRound, MapPin, UserRound, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermission } from "@/lib/permissions";
import { requireStaffMember } from "../data";
import { MemberArchiveControl } from "../MemberArchiveControl";
import { getAccessibleActiveBranches } from "../../services/access";
import MemberChurchEditor from "../MemberChurchEditor";
import MemberAccountEditor from "../MemberAccountEditor";
import { getAccountTargetScopes } from "../../accounts/target-scope";
import MemberCardButton from "../MemberCardButton";
import { loadMemberAccountEmail } from "../account-email";

export default function MemberPage(props: { params: Promise<{ memberId: string }> }) {
  return <Suspense fallback={<PageSkeleton kind="detail" fields={4} metrics={0} columns={5} label="members" />}><Content {...props} /></Suspense>;
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

  const { data: linkedProfile } = account ? await admin.from("profiles").select("display_name,archived_at").eq("id", account.userId).maybeSingle() : { data: null };
  const target = account && can("accounts.update_display_name") ? (await getAccountTargetScopes(access, admin, account.userId)).get(account.userId) : null;
  const accountEditable = Boolean(account && linkedProfile && !linkedProfile.archived_at && target?.canChangeAccount);
  const fullName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
  const accountStatus = member.account_status === "connected" ? "Connected" : member.account_status === "invited" ? "Invited" : "No Account";
  const profileStatus = member.profile_status === "completed" ? "Complete" : "Incomplete";
  const address = [member.street_address, member.barangay, member.city, member.province, member.country].filter(Boolean).join(", ");
  const canEditChurch = !member.is_archived && can("members.update");
  const branches = canEditChurch ? await getAccessibleActiveBranches(access, admin) : [];
  const { data: departments, error: departmentsError } = canEditChurch ? await admin.from("departments").select("id,name,is_active").order("name") : { data: [], error: null };
  if (departmentsError) throw new Error("Unable to load departments.");
  const departmentOptions = (departments ?? []).filter(row => row.is_active || row.id === member.department_id);

  return <PageContainer className="max-w-5xl">
    <PageHeader
      eyebrow="Member Record"
      eyebrowIcon={<UsersRound className="h-4 w-4" />}
      title="Member Details"
      description={member.is_archived ? "Archived member record" : "Member identity and church information"}
      backHref="/portal/members"
      backLabel="Back to Members"
      action={<div className="flex flex-wrap gap-2">
        {member.account_status === "no_account" && !member.is_archived && can("members.link_account") &&
          <Button variant="outline" asChild><Link href={`/portal/members/invite?memberId=${memberId}`}>Connect Account</Link></Button>}
      </div>}
    />

    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span tabIndex={0} aria-label={`Member Status: ${member.member_status === "active" ? "Active" : "Inactive"}`}
              className={`group inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${member.member_status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
              <span className="h-3 w-3 rounded-full" aria-hidden="true" />
              <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">{member.member_status === "active" ? "Active" : "Inactive"}</span>
            </span>
            <h2 className="font-radio-canada text-2xl font-semibold text-[#203264] sm:text-3xl">{fullName}</h2>
            <MemberCardButton member={{ ...member, department, church_branch: branch }} />
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" aria-hidden="true" />{branch?.name ?? "Not assigned"}</p>
        </div>
        {member.is_archived && <StatusBadge variant="muted">Archived</StatusBadge>}
      </div>

    </CardContent></Card>

    <MemberChurchEditor memberId={memberId} member={member} branches={branches} departments={departmentOptions} canEdit={canEditChurch}>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Church Branch" value={branch?.name ?? "Not assigned"} />
          <Info label="First Attendance (Historical)" value={member.first_attendance_date ?? "Unknown"} />
          <Info label="Department" value={department?.name ?? "Not assigned"} />
          <Info label="Position" value={member.position ?? "Not provided"} />
          <Info label="Zone" value={member.zone == null ? "Not assigned" : String(member.zone)} />
        </dl>
    </MemberChurchEditor>

    <MemberAccountEditor memberId={memberId} displayName={linkedProfile?.display_name ?? ""}
      canEditName={accountEditable && can("accounts.update_display_name")}
      badge={<StatusBadge variant={member.account_status === "connected" ? "success" : member.account_status === "invited" ? "warning" : "muted"}>{accountStatus}</StatusBadge>}>
      <Info label="Account Email" value={account ? account.email ?? "No email available" : "No linked account"} />
    </MemberAccountEditor>

    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-[#203264]"><UserRound className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />Personal Information</h2>
          <StatusBadge variant={member.profile_status === "completed" ? "info" : "muted"}>{profileStatus}</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Info label="Phone" value={member.phone_number ?? "Not provided"} />
          <Info label="Birthday" value={member.birth_date ?? "Not provided"} />
          <Info label="Gender" value={member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : "Not provided"} />
          <Info label="Address" value={address || "Not provided"} className="sm:col-span-2" />
        </dl>
      </CardContent>
    </Card>

    {(can("baptisms.view") || can("contributions.view") || can("attendance.view") || can("follow_ups.view") || can("follow_ups.create")) && <Card>
      <CardContent className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-[#203264]"><Activity className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />Care and Activity</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {can("baptisms.view") && <Button variant="outline" asChild><Link href={`/portal/baptisms/member/${memberId}?returnTo=${encodeURIComponent(`/portal/members/${memberId}`)}`}><Droplets />View Baptism Records</Link></Button>}
          {can("contributions.view") && <Button variant="outline" asChild><Link href={`/portal/contributions/member/${memberId}?returnTo=${encodeURIComponent(`/portal/members/${memberId}`)}`}><HandCoins />View Contribution History</Link></Button>}
          {can("attendance.view") && <Button variant="outline" asChild><Link href={`/portal/attendance/member/${memberId}?returnTo=${encodeURIComponent(`/portal/members/${memberId}`)}`}><HeartPulse />View Attendance History</Link></Button>}
          {can("follow_ups.view") && <Button variant="outline" asChild><Link href={`/portal/follow-ups/member/${memberId}?returnTo=${encodeURIComponent(`/portal/members/${memberId}`)}`}><ClipboardPen />Follow-up History</Link></Button>}
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
