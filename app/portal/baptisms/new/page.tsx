import Link from "next/link";
import { Suspense } from "react";
import { Droplets } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  canManageBaptisms,
  requireBaptismsAccess,
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
  const access = await requireBaptismsAccess();

  if (!canManageBaptisms(access)) {
    return (
      <PageContainer>
        <PageHeader
          backHref="/portal/baptisms"
          backLabel="Back to Baptism Records"
          eyebrow="Spiritual Ministry"
          eyebrowIcon={<Droplets className="h-4 w-4" />}
          title="New Baptism Record"
          description="Record a baptism for an assigned active branch."
        />

        <EmptyState
          icon={<Droplets className="h-5 w-5" />}
          title="View-only access"
          description="Only spiritual ministry officers can create or edit baptism records."
          action={
            <Button asChild variant="outline">
              <Link href="/portal/baptisms">
                Back to Baptism Records
              </Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const admin = createAdminClient();
  const options = await loadBaptismOptions(access, admin);

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
