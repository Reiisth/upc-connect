import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Droplets } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateBaptism } from "../../actions";
import {
  getBaptismUpdatePermission,
  requireBaptismUpdateAccess,
} from "../../access";
import { hasPermission } from "@/lib/permissions";
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
  const access = await requireBaptismUpdateAccess();

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

  const updatePermission = getBaptismUpdatePermission(
    baptism.baptismType,
  );

  if (
    !updatePermission ||
    !hasPermission(access.permissions, updatePermission)
  ) {
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
        allowedBaptismTypes={[baptism.baptismType]}
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
