import { Suspense } from "react";
import { UserPlus } from "lucide-react";

import { requireMembersPermission } from "../access";
import { createMember } from "../actions";
import { MemberChurchForm } from "../MemberChurchForm";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleActiveBranches } from "../../services/access";

export default function NewMemberPage(props: { searchParams: Promise<{ created?: string }> }) {
  return (
    <Suspense fallback={<NewMemberLoading />}>
      <NewMemberContent {...props} />
    </Suspense>
  );
}

async function NewMemberContent({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const access = await requireMembersPermission("members.create");
  const branches = await getAccessibleActiveBranches(
    access,
    createAdminClient(),
  );

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        backHref="/portal/members"
        backLabel="Back to Members"
        eyebrow="Member Management"
        eyebrowIcon={<UserPlus className="h-4 w-4" />}
        title="Create Member"
        description="Create a basic member record. The member can complete the rest of their profile once their account is connected."
      />

      {created === "1" && <p role="status">Member created. Your account does not have permission to open the record.</p>}
      {branches.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before creating a member record."
        />
      ) : (
        <MemberChurchForm action={createMember} branches={branches} />
      )}
    </PageContainer>
  );
}

function NewMemberLoading() {
  return (
    <PageContainer className="max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[360px] rounded-2xl" />
    </PageContainer>
  );
}
