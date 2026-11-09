import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";

import { requireMembersPermission } from "../access";
import { createMember } from "../actions";
import { MemberChurchForm } from "../MemberChurchForm";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleActiveBranches } from "../../services/access";

export default function NewMemberPage(props: { searchParams: Promise<{ created?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="members new" />}>
      <NewMemberContent {...props} />
    </Suspense>
  );
}

async function NewMemberContent({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const access = await requireMembersPermission("members.create");
  const admin = createAdminClient();
  const [branches, departmentsResult] = await Promise.all([
    getAccessibleActiveBranches(access, admin),
    admin.from("departments").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (departmentsResult.error) throw new Error("Unable to load departments.");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        backHref="/portal/members"
        backLabel="Back to Members"
        eyebrow="Member Management"
        eyebrowIcon={<UserPlus className="h-4 w-4" />}
        title="New Member"
        description="Create a member record. Account connection is optional and can be managed later."
      />

      {created === "1" && <p role="status">Member created. Your account does not have permission to open the record.</p>}
      {branches.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before creating a member record."
        />
      ) : (
        <MemberChurchForm action={createMember} branches={branches} departments={departmentsResult.data ?? []} cancelHref="/portal/members" />
      )}
    </PageContainer>
  );
}
