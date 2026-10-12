import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HeartHandshake } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateWedding } from "../../actions";
import { requireWeddingsPermission } from "../../access";
import { WeddingForm } from "../../WeddingForm";
import {
  loadWeddingForEdit,
  loadWeddingOptions,
} from "../../data";

type EditWeddingPageProps = {
  params: Promise<{
    weddingId: string;
  }>;
};

export default function EditWeddingPage(
  props: EditWeddingPageProps,
) {
  return (
    <Suspense fallback={<EditWeddingLoading />}>
      <EditWeddingContent {...props} />
    </Suspense>
  );
}

async function EditWeddingContent({
  params,
}: EditWeddingPageProps) {
  const access = await requireWeddingsPermission("weddings.update");
  const { weddingId } = await params;
  const admin = createAdminClient();
  const options = await loadWeddingOptions(access, admin);
  const wedding = await loadWeddingForEdit(
    admin,
    options.branches,
    weddingId,
  );

  if (!wedding) {
    notFound();
  }

  const updateAction = updateWedding.bind(null, wedding.id);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/weddings"
        backLabel="Back to Wedding Records"
        eyebrow="Family Records"
        eyebrowIcon={<HeartHandshake className="h-4 w-4" />}
        title="Edit Wedding Record"
        description="Update the wedding details while preserving its original recorder and historical member links."
      />

      <WeddingForm
        branches={options.branches}
        members={options.members}
        action={updateAction}
        submitLabel="Save Changes"
        values={{
          memberId: wedding.memberId,
          spouseSource: wedding.spouseMemberId ? "member" : "external",
          spouseMemberId: wedding.spouseMemberId,
          spouseName: wedding.spouseName ?? "",
          weddingDate: wedding.weddingDate,
          churchBranchId: wedding.churchBranchId,
          officiatedBy: wedding.officiatedBy ?? "",
          location: wedding.location ?? "",
          certificateNumber: wedding.certificateNumber ?? "",
          notes: wedding.notes ?? "",
        }}
      />
    </PageContainer>
  );
}

function EditWeddingLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[760px] rounded-2xl" />
    </PageContainer>
  );
}
