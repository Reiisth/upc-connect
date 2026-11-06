import { effectiveStoredServiceStatus } from "../../lifecycle";
import { EmptyState } from "@/components/ui/empty-state";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateServiceFormAction } from "../../actions";
import {
  getAccessibleActiveBranches,
  requireServicesPermission,
} from "../../access";
import { ServiceForm } from "../../ServiceForm";
import type {
  ServiceType,
} from "../../types";

type EditServicePageProps = {
  params: Promise<{
    serviceId: string;
  }>;
};

type ServiceRow = {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  start_time: string | null;
  status: string;
  church_branch_id: string;
  notes: string | null;
};

export default function EditServicePage(
  props: EditServicePageProps,
) {
  return (
    <Suspense fallback={<EditServiceLoading />}>
      <EditServiceContent {...props} />
    </Suspense>
  );
}

async function EditServiceContent({
  params,
}: EditServicePageProps) {
  const access = await requireServicesPermission("services.update");
  const { serviceId } = await params;

  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );

  if (branches.length === 0) {
    notFound();
  }

  const { data, error } = await admin
    .from("services")
    .select(
      "id, name, service_type, service_date, start_time, status, church_branch_id, notes",
    )
    .eq("id", serviceId)
    .in(
      "church_branch_id",
      branches.map((branch) => branch.id),
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    notFound();
  }

  const service = data as ServiceRow;
  if (effectiveStoredServiceStatus(service) !== "scheduled") return <PageContainer><PageHeader backHref="/portal/services" backLabel="Back to Services" title="Service is read-only" /><EmptyState title="Scheduling edits are closed" description="Only a future Scheduled Service can be edited. Use Services for explicit completion or cancellation; recorded history is retained." /></PageContainer>;
  const { data: types, error: typesError } = await admin.from("service_types").select("key,name,is_active").order("name");
  if (typesError) throw new Error("Unable to load service types.");
  const serviceTypes = (types ?? []).filter((t) => t.is_active || t.key === service.service_type).map((t) => ({ key: t.key, name: t.name, isActive: t.is_active }));
  const updateServiceAction = updateServiceFormAction.bind(
    null,
    service.id,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/services"
        backLabel="Back to Services"
        eyebrow="Attendance Operations"
        eyebrowIcon={<CalendarDays className="h-4 w-4" />}
        title="Edit Service"
        description={`Update the future schedule for ${service.name}.`}
      />

      <ServiceForm
        branches={branches}
        serviceTypes={serviceTypes}
        action={updateServiceAction}
        submitLabel="Save Changes"
        values={{
          name: service.name,
          serviceType: service.service_type as ServiceType,
          serviceDate: service.service_date,
          startTime: service.start_time,
          churchBranchId: service.church_branch_id,
          notes: service.notes,
        }}
      />
    </PageContainer>
  );
}

function EditServiceLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-[520px] rounded-2xl" />
    </PageContainer>
  );
}
