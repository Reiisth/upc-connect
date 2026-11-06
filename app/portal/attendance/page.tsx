import { readAllPages } from "@/lib/supabase/read-all-pages";
import { hasPermission } from "@/lib/permissions";
import { effectiveStoredServiceStatus } from "@/app/portal/services/lifecycle";
import { loadAttendanceDashboard } from "@/lib/attendance-dashboard";
import { Suspense } from "react";
import {
  ClipboardCheck,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { getAccessibleActiveBranches } from "../services/access";
import AttendanceServicesTable from "./AttendanceServicesTable";
import { requireAttendancePermission } from "./access";
import type { ServiceBranch, ServiceRecord } from "../services/types";

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

export default function AttendancePage() {
  return (
    <Suspense fallback={<AttendanceLoading />}>
      <AttendanceContent />
    </Suspense>
  );
}

async function AttendanceContent() {
  const access = await requireAttendancePermission(
    "attendance.view",
  );
  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const branchIds = branches.map((branch) => branch.id);
  let rows: ServiceRow[] = [];

  if (branchIds.length > 0) {
    rows = await readAllPages((from,to) => admin.from("services")
      .select("id, name, service_type, service_date, start_time, status, church_branch_id, notes")
      .in("church_branch_id",branchIds).in("status",["scheduled","ongoing"])
      .order("service_date").order("id").range(from,to)) as ServiceRow[];
  }
  const { data: typeRows, error: typeError } = await admin.from("service_types").select("key,name,is_active").order("name");
  if (typeError) throw new Error("Unable to load service type labels.");
  const serviceTypes = (typeRows ?? []).map((t) => ({ key: t.key, name: t.name, isActive: t.is_active }));
  const serviceTypeNames = Object.fromEntries(serviceTypes.map((t) => [t.key, t.name]));

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

  const dashboard = await loadAttendanceDashboard(admin, branches);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Attendance Operations"
        eyebrowIcon={<ClipboardCheck className="h-4 w-4" />}
        title="Attendance"
        description="Record attendance for Ongoing Services and prepare for Upcoming Services. Refresh when a start time is reached."
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so attendance cannot be displayed."
        />
      ) : (
        <AttendanceServicesTable
          dashboard={dashboard}
          canEditServices={hasPermission(access.permissions,"services.update")}
          services={services}
          branches={branches}
          serviceTypes={serviceTypes}
          serviceTypeNames={serviceTypeNames}
        />
      )}
    </PageContainer>
  );
}

function AttendanceLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </PageContainer>
  );
}
