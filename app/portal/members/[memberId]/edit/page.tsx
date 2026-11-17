import { memberHistoryNavigation } from "@/lib/member-history-navigation";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaffMember } from "../../data";
import { updateMember } from "../../actions";
import { MemberChurchForm } from "../../MemberChurchForm";
import { getAccessibleActiveBranches } from "../../../services/access";

type Props = { params: Promise<{ memberId: string }>; searchParams?: Promise<{ returnTo?: string | string[] }> };
export default function EditMemberPage(props: Props) {
  return <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="members edit" />}><Content {...props} /></Suspense>;
}
async function Content({ params, searchParams }: Props) {
  const { memberId } = await params;
  const { member, access, admin } = await requireStaffMember(memberId, "members.update");
  if (member.is_archived) redirect("/access-denied");
  const branches = await getAccessibleActiveBranches(access, admin);
  const { data: departments, error } = await admin.from("departments").select("id, name, is_active").order("name");
  if (error) throw new Error("Unable to load departments.");
  const departmentOptions = (departments ?? []).filter((department) => department.is_active || department.id === member.department_id);
  const navigation = memberHistoryNavigation(memberId, (await searchParams)?.returnTo, access.permissions.includes("members.view") ? `/portal/members/${memberId}` : "/portal/members", "Back to Member");
  return <PageContainer className="max-w-4xl">
    <PageHeader title="Edit Church Information" description="Maintain church-controlled information."
      backHref={navigation.backHref} backLabel={navigation.backLabel} />
    <MemberChurchForm action={updateMember.bind(null, memberId)} branches={branches} departments={departmentOptions} member={member} editing
      cancelHref={navigation.backHref} />
  </PageContainer>;
}
