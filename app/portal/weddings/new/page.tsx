import { Suspense } from "react";
import { HeartHandshake } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireWeddingsPermission } from "../access";
import { createWedding } from "../actions";
import { loadWeddingOptions } from "../data";
import { WeddingForm } from "../WeddingForm";

export default function NewWeddingPage() {
  return (
    <Suspense fallback={<NewWeddingLoading />}>
      <NewWeddingContent />
    </Suspense>
  );
}

async function NewWeddingContent() {
  const access = await requireWeddingsPermission("weddings.create");
  const admin = createAdminClient();
  const options = await loadWeddingOptions(access, admin);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/weddings"
        backLabel="Back to Wedding Records"
        eyebrow="Family Records"
        eyebrowIcon={<HeartHandshake className="h-4 w-4" />}
        title="New Wedding Record"
        description="Record a wedding for an assigned active branch."
      />

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before creating a wedding record."
        />
      ) : (
        <WeddingForm
          branches={options.branches}
          members={options.members}
          action={createWedding}
          submitLabel="Save Wedding Record"
        />
      )}
    </PageContainer>
  );
}

function NewWeddingLoading() {
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
