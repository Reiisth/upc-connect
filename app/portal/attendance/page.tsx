import { Suspense } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
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
    const { data, error } = await admin
      .from("services")
      .select(
        "id, name, service_type, service_date, start_time, status, church_branch_id, notes",
      )
      .in("church_branch_id", branchIds)
      .order("service_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    rows = (data ?? []) as ServiceRow[];
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
    status: service.status as ServiceRecord["status"],
    churchBranchId: service.church_branch_id,
    notes: service.notes,
    branch: branchMap.get(service.church_branch_id) ?? null,
  }));

  const ongoingCount = services.filter(
    (service) => service.status === "ongoing",
  ).length;
  const scheduledCount = services.filter(
    (service) => service.status === "scheduled",
  ).length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Attendance Operations"
        eyebrowIcon={<ClipboardCheck className="h-4 w-4" />}
        title="Attendance"
        description="Choose a service to review attendance and record member participation."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AttendanceSummaryCard
          label="Visible Services"
          value={services.length}
          icon={<CalendarDays />}
        />

        <AttendanceSummaryCard
          label="Scheduled"
          value={scheduledCount}
          icon={<Clock3 />}
          valueClassName="text-amber-700"
        />

        <AttendanceSummaryCard
          label="Ongoing"
          value={ongoingCount}
          icon={<CheckCircle2 />}
          valueClassName="text-emerald-700"
        />
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so attendance cannot be displayed."
        />
      ) : (
        <AttendanceServicesTable
          services={services}
          branches={branches}
        />
      )}
    </PageContainer>
  );
}

function AttendanceSummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264]",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>

            <p className={`mt-3 text-3xl font-semibold ${valueClassName}`}>
              {value}
            </p>
          </div>

          <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
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
