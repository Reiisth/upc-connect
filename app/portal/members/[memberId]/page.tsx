import { Suspense } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaffMember } from "../data";
import { MemberArchiveControl } from "../MemberArchiveControl";

export default function MemberPage(props: { params: Promise<{ memberId: string }> }) {
  return <Suspense fallback={<Skeleton className="h-96" />}><Content {...props} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { member, access, admin } = await requireStaffMember(memberId, "members.view");
  const can = (permission: typeof access.permissions[number]) => access.permissions.includes(permission);
  const [{ data: branch }, { data: department }] = await Promise.all([
    member.church_branch_id ? admin.from("church_branches").select("name").eq("id", member.church_branch_id).maybeSingle() : Promise.resolve({ data: null }),
    member.department_id ? admin.from("departments").select("name").eq("id", member.department_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const accountLink = member.account_status === "connected" && can("accounts.view")
    ? await admin.from("account_members").select("user_id")
      .eq("member_id", memberId).eq("relationship", "member").maybeSingle()
    : { data: null, error: null };
  if (accountLink.error) throw new Error(accountLink.error.message);
  return <PageContainer>
    <PageHeader title={[member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ")}
      description="Staff member record. Church information and personal self-service have separate editing permissions."
      backHref="/portal/members" backLabel="Back to Members"
      action={!member.is_archived && can("members.update") ? <Button asChild><Link href={`/portal/members/${memberId}/edit`}>Edit Member</Link></Button> : undefined} />
    <Card><CardContent className="space-y-2 p-6">
      <h2 className="font-semibold">Church Information</h2>
      <p>Branch: {branch?.name ?? "Unassigned"}</p>
      <p>First attendance: {member.first_attendance_date ?? "Unknown — inactivity eligibility cannot be calculated"}</p>
      <p>Administrative member status: {member.member_status ?? "Not set"} (separate from derived inactivity)</p>
      <p>Member archive: {member.is_archived ? "Archived" : "Not archived"}</p>
      <p>Department: {department?.name ?? "Unassigned"} · Position: {member.position ?? "Unassigned"} · Zone: {member.zone ?? "Unassigned"}</p>
      <p className="text-sm text-slate-500">Branch is the current administrative assignment. Transfer-effective dates are not recorded.</p>
    </CardContent></Card>
    <Card><CardContent className="space-y-2 p-6">
      <h2 className="font-semibold">Account and Personal Profile</h2>
      <p>Account connection: {member.account_status} · Profile: {member.profile_status}</p>
      <p>Contact email: {member.email ?? "Not provided"} · Phone: {member.phone_number ?? "Not provided"}</p>
      <p>Birthday: {member.birth_date ?? "Not provided"} · Gender: {member.gender ?? "Not provided"}</p>
      <p>Address: {[member.street_address, member.barangay, member.city, member.province, member.country].filter(Boolean).join(", ") || "Not provided"}</p>
      {!member.is_archived && member.account_status === "no_account" && can("members.link_account") &&
        <Button asChild><Link href={`/portal/members/invite?memberId=${memberId}`}>Connect / Invite Account</Link></Button>}
      {member.account_status === "connected" && can("accounts.view") && accountLink.data?.user_id &&
        <Button asChild><Link href={`/portal/accounts/${accountLink.data.user_id}`}>Manage Account</Link></Button>}
    </CardContent></Card>
    <div className="flex flex-wrap gap-3">
      {can("follow_ups.view") && <Button asChild variant="outline"><Link href={`/portal/follow-ups/member/${memberId}`}>Follow-up History</Link></Button>}
      {can("attendance.view") && <Button asChild variant="outline"><Link href="/portal/attendance">Attendance Workspace</Link></Button>}
      {can("inactivity.view") && <Button asChild variant="outline"><Link href="/portal/inactivity">Inactivity Monitoring</Link></Button>}
      {can("members.archive") && <MemberArchiveControl memberId={memberId} archived={member.is_archived} />}
    </div>
  </PageContainer>;
}
