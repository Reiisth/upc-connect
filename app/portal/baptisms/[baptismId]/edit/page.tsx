import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Droplets } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";

import { updateBaptism } from "../../actions";
import {
  getBaptismUpdatePermission,
  requireBaptismUpdateAccess,
} from "../../access";
import { hasPermission } from "@/lib/permissions";
import { BaptismForm } from "../../BaptismForm";
import {
  loadBaptismForEdit,
  loadBaptismHistoricalMemberName,
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
    <Suspense fallback={<PageSkeleton kind="form" fields={8} metrics={0} columns={5} label="baptisms edit" />}>
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
  const branches = await getHistoricalRecordBranches(access, admin);
  const baptism = await loadBaptismForEdit(
    admin,
    branches,
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
  const memberName = await loadBaptismHistoricalMemberName(admin, baptism.memberId);

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
        branches={branches.filter((branch) => branch.id === baptism.churchBranchId)}
        members={[]}
        existingMemberName={memberName}
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
