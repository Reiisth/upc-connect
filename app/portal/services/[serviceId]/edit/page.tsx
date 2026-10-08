import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { updateService } from "../../actions";
import {
  canManageServices,
  getAccessibleActiveBranches,
  requireServicesAccess,
} from "../../access";
import { ServiceForm } from "../../ServiceForm";
import type {
  ServiceStatus,
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
  const access = await requireServicesAccess();
  const { serviceId } = await params;

  if (!canManageServices(access)) {
    return (
      <PageContainer>
        <PageHeader
          backHref="/portal/services"
          backLabel="Back to Services"
          eyebrow="Attendance Operations"
          eyebrowIcon={<CalendarDays className="h-4 w-4" />}
          title="Edit Service"
          description="Update a service schedule for an assigned branch."
        />

        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="View-only access"
          description="Only pastors can create or edit services."
          action={
            <Button asChild variant="outline">
              <Link href="/portal/services">Back to Services</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

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
  const updateServiceAction = updateService.bind(
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
        description={`Update the schedule and status for ${service.name}.`}
      />

      <ServiceForm
        branches={branches}
        action={updateServiceAction}
        submitLabel="Save Changes"
        values={{
          name: service.name,
          serviceType: service.service_type as ServiceType,
          serviceDate: service.service_date,
          startTime: service.start_time,
          status: service.status as ServiceStatus,
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
