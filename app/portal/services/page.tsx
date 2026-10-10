import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

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
    <Suspense fallback={<ServicesLoading />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  const access = await requireServicesPermission("services.view");
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
      .order("start_time", { ascending: false });

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

  const scheduledCount = services.filter(
    (service) => service.status === "scheduled",
  ).length;
  const ongoingCount = services.filter(
    (service) => service.status === "ongoing",
  ).length;
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

      <div className="grid gap-4 sm:grid-cols-3">
        <ServiceSummaryCard
          label="Visible Services"
          value={services.length}
          icon={<CalendarDays />}
        />

        <ServiceSummaryCard
          label="Scheduled"
          value={scheduledCount}
          icon={<Clock3 />}
          valueClassName="text-amber-700 dark:text-amber-400"
        />

        <ServiceSummaryCard
          label="Ongoing"
          value={ongoingCount}
          icon={<CheckCircle2 />}
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so services cannot be displayed."
        />
      ) : (
        <ServicesTable
          services={services}
          branches={branches}
          canEdit={canUpdate}
        />
      )}
    </PageContainer>
  );
}

function ServiceSummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264] dark:text-slate-100",
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>

            <p className={`mt-3 text-3xl font-semibold ${valueClassName}`}>
              {value}
            </p>
          </div>

          <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] dark:bg-slate-800 dark:text-slate-200 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServicesLoading() {
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
