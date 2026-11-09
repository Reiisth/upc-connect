import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaffMember } from "../../data";
import { updateMember } from "../../actions";
import { MemberChurchForm } from "../../MemberChurchForm";
import { getAccessibleActiveBranches } from "../../../services/access";

export default function EditMemberPage(props: { params: Promise<{ memberId: string }> }) {
  return <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="members edit" />}><Content {...props} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { member, access, admin } = await requireStaffMember(memberId, "members.update");
  if (member.is_archived) redirect("/access-denied");
  const branches = await getAccessibleActiveBranches(access, admin);
  const { data: departments, error } = await admin.from("departments").select("id, name, is_active").order("name");
  if (error) throw new Error("Unable to load departments.");
  const departmentOptions = (departments ?? []).filter((department) => department.is_active || department.id === member.department_id);
  return <PageContainer className="max-w-4xl">
    <PageHeader title="Edit Church Information" description="Maintain church-controlled information."
      backHref={access.permissions.includes("members.view") ? `/portal/members/${memberId}` : "/portal/members"} backLabel="Back to Member" />
    <MemberChurchForm action={updateMember.bind(null, memberId)} branches={branches} departments={departmentOptions} member={member} editing
      cancelHref={access.permissions.includes("members.view") ? `/portal/members/${memberId}` : "/portal/members"} />
  </PageContainer>;
}
