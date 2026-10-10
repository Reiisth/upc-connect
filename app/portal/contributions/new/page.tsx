import { Suspense } from "react";
import { HandCoins } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireContributionsPermission } from "../access";
import { createContribution } from "../actions";
import { loadContributionOptions } from "../data";
import { ContributionForm } from "../ContributionForm";

export default function NewContributionPage() {
  return (
    <Suspense fallback={<NewContributionLoading />}>
      <NewContributionContent />
    </Suspense>
  );
}

async function NewContributionContent() {
  const access = await requireContributionsPermission(
    "contributions.create",
  );

  const admin = createAdminClient();
  const options = await loadContributionOptions(access, admin);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/contributions"
        backLabel="Back to Contributions"
        eyebrow="Financial Operations"
        eyebrowIcon={<HandCoins className="h-4 w-4" />}
        title="New Contribution"
        description="Record a member-linked or anonymous contribution for an assigned active branch."
      />

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before recording a contribution."
        />
      ) : (
        <ContributionForm
          branches={options.branches}
          members={options.members}
          services={options.services}
          action={createContribution}
          submitLabel="Save Contribution"
        />
      )}
    </PageContainer>
  );
}

function NewContributionLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[620px] rounded-2xl" />
    </PageContainer>
  );
}
