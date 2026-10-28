import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { requireFollowUpsPermission } from "../../access";
import { updateFollowUp } from "../../actions";
import { loadFollowUpForEdit, loadFollowUpPerformers } from "../../data";
import FollowUpForm from "../../FollowUpForm";
import FollowUpsLoading from "../../loading";

type Props = { params: Promise<{ followUpId: string }>; searchParams: Promise<{ saved?: string }> };
export default function EditFollowUpPage(props: Props) {
  return <Suspense fallback={<FollowUpsLoading />}><EditFollowUpContent {...props} /></Suspense>;
}
async function EditFollowUpContent({ params, searchParams }: Props) {
  const access = await requireFollowUpsPermission("follow_ups.update");
  const admin = createAdminClient();
  const { followUpId } = await params;
  const row = await loadFollowUpForEdit(access, admin, followUpId);
  if (!row) notFound();
  const performers = row.branchIsActive ? await loadFollowUpPerformers(admin) : [];
  const back = hasPermission(access.permissions, "follow_ups.view") ? `/portal/follow-ups/member/${row.memberId}` : "/portal";
  return <PageContainer>
    <PageHeader title="Edit Follow-up" backHref={back} backLabel="Back"
      description="Correct this historical action. Its original member, branch and recorder remain unchanged." />
    {(await searchParams).saved === "1" && <p role="status" className="text-sm text-emerald-700">Follow-up updated successfully.</p>}
    {!row.branchIsActive ? <EmptyState title="This branch is inactive" description="History is preserved. Corrections require the record’s stored branch to be active." /> :
      <FollowUpForm action={updateFollowUp.bind(null, row.id)} immutable performers={performers} historicalPerformerName={row.performerName} cancelHref={back}
        branches={[{ id: row.branchId, name: row.branchName, code: null, isActive: row.branchIsActive }]}
        members={[{ id: row.memberId, name: row.memberName, branchId: row.branchId, isArchived: false }]}
        initialValues={{ branchId: row.branchId, memberId: row.memberId, followUpDate: row.followUpDate, method: row.method, outcome: row.outcome,
          followedUpBy: row.followedUpBy ?? "", notes: row.notes ?? "", nextFollowUpDate: row.nextFollowUpDate ?? "" }} />}
  </PageContainer>;
}
