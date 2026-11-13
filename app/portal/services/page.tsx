import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { effectiveStoredServiceStatus } from "@/app/portal/services/lifecycle";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/read-all-pages";

import {
  getAccessibleActiveBranches,
  requireServicesPermission,
} from "./access";
import ServicesTable from "./ServicesTable";
import type { ServiceBranch, ServiceRecord } from "./types";

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

export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="services" />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  "use cache: private";
  cacheLife({ stale: 30 });
  cacheTag("portal:services");
  const access = await requireServicesPermission("services.view");
  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const branchIds = branches.map((branch) => branch.id);
  const labelsPromise = Promise.resolve(admin.from("service_types").select("key,name,is_active").order("name"));

  let rows: ServiceRow[] = [];

  if (branchIds.length > 0) {
    rows = await readAllPages((from, to) => admin
      .from("services")
      .select(
        "id, name, service_type, service_date, start_time, status, church_branch_id, notes",
      )
      .in("church_branch_id", branchIds)
      .order("service_date", { ascending: false })
      .order("start_time", { ascending: false }).order("id")
      .range(from, to)) as ServiceRow[];
  }

  const branchMap = new Map(
    branches.map((branch) => [
      branch.id,
      {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isActive: branch.isActive,
      } satisfies ServiceBranch,
    ]),
  );

  const services: ServiceRecord[] = rows.map((service) => ({
    id: service.id,
    name: service.name,
    serviceType: service.service_type as ServiceRecord["serviceType"],
    serviceDate: service.service_date,
    startTime: service.start_time,
    status: effectiveStoredServiceStatus(service),
    churchBranchId: service.church_branch_id,
    notes: service.notes,
    branch: branchMap.get(service.church_branch_id) ?? null,
  }));
  const { data: serviceTypeRows, error: serviceTypeError } = await labelsPromise;
  if (serviceTypeError) throw new Error("Unable to load service type labels.");
  const serviceTypes = (serviceTypeRows ?? []).map((row) => ({ key: row.key, name: row.name, isActive: row.is_active }));
  const serviceTypeNames = Object.fromEntries(serviceTypes.map((type) => [type.key, type.name]));

  const canCreate = hasPermission(
    access.permissions,
    "services.create",
  );
  const canUpdate = hasPermission(
    access.permissions,
    "services.update",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Attendance Operations"
        eyebrowIcon={<CalendarDays className="h-4 w-4" />}
        title="Services"
        description="View branch service schedules and manage upcoming services."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/portal/services/new">
                <Plus />
                New Service
              </Link>
            </Button>
          ) : undefined
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so services cannot be displayed."
        />
      ) : (
        <ServicesTable
          services={services}
          serviceTypes={serviceTypes}
          serviceTypeNames={serviceTypeNames}
          branches={branches}
          canEdit={canUpdate}
          canManageAttendance={hasPermission(access.permissions, "attendance.view")}
        />
      )}
    </PageContainer>
  );
}
