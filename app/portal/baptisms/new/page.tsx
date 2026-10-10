import { Suspense } from "react";
import { Droplets } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getAllowedBaptismCreateTypes,
  requireBaptismCreateAccess,
} from "../access";
import { createBaptism } from "../actions";
import { BaptismForm } from "../BaptismForm";
import { loadBaptismOptions } from "../data";

export default function NewBaptismPage() {
  return (
    <Suspense fallback={<NewBaptismLoading />}>
      <NewBaptismContent />
    </Suspense>
  );
}

async function NewBaptismContent() {
  const access = await requireBaptismCreateAccess();

  const admin = createAdminClient();
  const options = await loadBaptismOptions(access, admin);
  const allowedBaptismTypes = getAllowedBaptismCreateTypes(
    access.permissions,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/baptisms"
        backLabel="Back to Baptism Records"
        eyebrow="Spiritual Ministry"
        eyebrowIcon={<Droplets className="h-4 w-4" />}
        title="New Baptism Record"
        description="Record a water or Holy Ghost baptism for an active member."
      />

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<Droplets className="h-5 w-5" />}
          title="No active branches available"
          description="You need access to an active church branch before recording a baptism."
        />
      ) : (
        <BaptismForm
          branches={options.branches}
          members={options.members}
          allowedBaptismTypes={allowedBaptismTypes}
          action={createBaptism}
          submitLabel="Save Baptism Record"
        />
      )}
    </PageContainer>
  );
}

function NewBaptismLoading() {
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
