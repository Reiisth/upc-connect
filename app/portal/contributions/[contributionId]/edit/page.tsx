import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HandCoins } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";

import { updateContribution } from "../../actions";
import { requireContributionsPermission } from "../../access";
import {
  loadContributionForEdit,
  loadContributionEditOptions,
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
    <Suspense fallback={<PageSkeleton kind="form" fields={8} metrics={0} columns={5} label="contributions edit" />}>
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
  const branches = await getHistoricalRecordBranches(access, admin);
  const contribution = await loadContributionForEdit(
    admin,
    branches,
    contributionId,
  );

  if (!contribution) {
    notFound();
  }
  const options = await loadContributionEditOptions(access, admin, contribution);

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
        description="Correct contribution details while preserving its historical branch and original recorder."
      />

      <ContributionForm
        branches={branches.filter((branch) => branch.id === contribution.churchBranchId)}
        members={options.members}
        services={options.services}
        action={updateAction}
        submitLabel="Save Changes"
        values={{
          memberId: contribution.memberId,
          contributorType: contribution.contributorType,
          visitorName: contribution.visitorName,
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
