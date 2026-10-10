import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HandCoins } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateContribution } from "../../actions";
import { requireContributionsPermission } from "../../access";
import {
  loadContributionForEdit,
  loadContributionOptions,
} from "../../data";
import { ContributionForm } from "../../ContributionForm";

type EditContributionPageProps = {
  params: Promise<{
    contributionId: string;
  }>;
};

export default function EditContributionPage(
  props: EditContributionPageProps,
) {
  return (
    <Suspense fallback={<EditContributionLoading />}>
      <EditContributionContent {...props} />
    </Suspense>
  );
}

async function EditContributionContent({
  params,
}: EditContributionPageProps) {
  const access = await requireContributionsPermission(
    "contributions.update",
  );

  const { contributionId } = await params;
  const admin = createAdminClient();
  const options = await loadContributionOptions(access, admin);
  const contribution = await loadContributionForEdit(
    admin,
    options.branches,
    contributionId,
  );

  if (!contribution) {
    notFound();
  }

  const updateAction = updateContribution.bind(
    null,
    contribution.id,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/contributions"
        backLabel="Back to Contributions"
        eyebrow="Financial Operations"
        eyebrowIcon={<HandCoins className="h-4 w-4" />}
        title="Edit Contribution"
        description="Update the contribution details while preserving its original recorder."
      />

      <ContributionForm
        branches={options.branches}
        members={options.members}
        services={options.services}
        action={updateAction}
        submitLabel="Save Changes"
        values={{
          memberId: contribution.memberId,
          serviceId: contribution.serviceId,
          churchBranchId: contribution.churchBranchId,
          contributionType: contribution.contributionType,
          amount: String(contribution.amount),
          contributionDate: contribution.contributionDate,
          paymentMethod: contribution.paymentMethod,
          notes: contribution.notes,
        }}
      />
    </PageContainer>
  );
}

function EditContributionLoading() {
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
