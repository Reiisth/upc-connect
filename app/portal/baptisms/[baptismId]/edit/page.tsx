import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Droplets } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateBaptism } from "../../actions";
import {
  canManageBaptisms,
  requireBaptismsAccess,
} from "../../access";
import { BaptismForm } from "../../BaptismForm";
import {
  loadBaptismForEdit,
  loadBaptismOptions,
} from "../../data";

type EditBaptismPageProps = {
  params: Promise<{
    baptismId: string;
  }>;
};

export default function EditBaptismPage(
  props: EditBaptismPageProps,
) {
  return (
    <Suspense fallback={<EditBaptismLoading />}>
      <EditBaptismContent {...props} />
    </Suspense>
  );
}

async function EditBaptismContent({
  params,
}: EditBaptismPageProps) {
  const access = await requireBaptismsAccess();

  if (!canManageBaptisms(access)) {
    return (
      <PageContainer>
        <PageHeader
          backHref="/portal/baptisms"
          backLabel="Back to Baptism Records"
          eyebrow="Spiritual Ministry"
          eyebrowIcon={<Droplets className="h-4 w-4" />}
          title="Edit Baptism Record"
          description="Baptism records are read-only for this account."
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

  const { baptismId } = await params;
  const admin = createAdminClient();
  const options = await loadBaptismOptions(access, admin);
  const baptism = await loadBaptismForEdit(
    admin,
    options.branches,
    baptismId,
  );

  if (!baptism) {
    notFound();
  }

  const updateAction = updateBaptism.bind(null, baptism.id);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/baptisms"
        backLabel="Back to Baptism Records"
        eyebrow="Spiritual Ministry"
        eyebrowIcon={<Droplets className="h-4 w-4" />}
        title="Edit Baptism Record"
        description="Update the record while preserving its original recorder and historical member links."
      />

      <BaptismForm
        branches={options.branches}
        members={options.members}
        action={updateAction}
        submitLabel="Save Changes"
        values={{
          memberId: baptism.memberId,
          baptismType: baptism.baptismType,
          baptismDate: baptism.baptismDate ?? "",
          churchBranchId: baptism.churchBranchId,
          officiatedBy: baptism.officiatedBy ?? "",
          location: baptism.location ?? "",
          notes: baptism.notes ?? "",
        }}
      />
    </PageContainer>
  );
}

function EditBaptismLoading() {
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
