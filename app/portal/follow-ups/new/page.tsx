import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { manilaDate } from "@/lib/inactivity/calculate";
import { requireFollowUpsPermission } from "../access";
import { createFollowUp } from "../actions";
import { loadFollowUpFormOptions } from "../data";
import FollowUpForm from "../FollowUpForm";
import FollowUpsLoading from "../loading";

type Props = { searchParams: Promise<{ memberId?: string | string[]; branchId?: string | string[]; saved?: string }> };
export default function NewFollowUpPage(props: Props) {
  return <Suspense fallback={<FollowUpsLoading />}><NewFollowUpContent {...props} /></Suspense>;
}
async function NewFollowUpContent({ searchParams }: Props) {
  const access = await requireFollowUpsPermission("follow_ups.create");
  const options = await loadFollowUpFormOptions(access, createAdminClient());
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const requestedMember = one(params.memberId), requestedBranch = one(params.branchId);
  const member = requestedMember ? options.members.find((item) => item.id === requestedMember) : null;
  const branchId = requestedBranch || member?.branchId || options.branches[0]?.id || "";
  if ((requestedMember && !member) || (requestedBranch && !options.branches.some((b) => b.id === branchId)) || (member && member.branchId !== branchId)) notFound();
  const canView = hasPermission(access.permissions, "follow_ups.view");
  return <PageContainer>
    <PageHeader backHref={canView ? "/portal/follow-ups" : "/portal"} backLabel={canView ? "Back to Follow-ups" : "Back to Portal"}
      title="Record Follow-up" description="Record a contact or attempted contact that took place. Members do not need to be inactive." />
    {params.saved === "1" && <p role="status" className="text-sm text-emerald-700">Follow-up recorded successfully.</p>}
    {!options.branches.length ? <EmptyState title="No active branch access" description="An accessible active branch is required to record a follow-up." /> :
      <FollowUpForm {...options} action={createFollowUp} cancelHref={canView ? "/portal/follow-ups" : "/portal"}
        initialValues={{ branchId, memberId: member?.id ?? "", followUpDate: manilaDate(new Date()), method: "call", outcome: "contacted",
          followedUpBy: options.performers.some((p) => p.id === access.user.id) ? access.user.id : "", notes: "", nextFollowUpDate: "" }} />}
  </PageContainer>;
}
