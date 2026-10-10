import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAttendancePermission } from "../../access";
import { loadAccessibleService } from "../../data";
import {
  canScanServiceStatus,
} from "../../types";
import QrAttendanceScanner from "./QrAttendanceScanner";

type QrAttendancePageProps = {
  params: Promise<{
    serviceId: string;
  }>;
};

export default function QrAttendancePage(
  props: QrAttendancePageProps,
) {
  return (
    <Suspense fallback={<QrAttendanceLoading />}>
      <QrAttendanceContent {...props} />
    </Suspense>
  );
}

async function QrAttendanceContent({
  params,
}: QrAttendancePageProps) {
  const access = await requireAttendancePermission(
    "attendance.record",
  );
  const { serviceId } = await params;
  const admin = createAdminClient();
  const service = await loadAccessibleService(
    access,
    admin,
    serviceId,
  );

  if (!service) {
    notFound();
  }

  const canScan = hasPermission(
    access.permissions,
    "attendance.record",
  );
  const statusAllowsScanning = canScanServiceStatus(
    service.status,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref={`/portal/attendance/${service.id}`}
        backLabel="Back to Service Attendance"
        eyebrow="Attendance"
        eyebrowIcon={<ClipboardCheck className="h-4 w-4" />}
        title="Scan Attendance"
        description="Use a member QR code to record attendance for this service."
      />

      <Card>
        <CardHeader>
          <CardTitle>{service.name}</CardTitle>
          <CardDescription>
            Scanning is fixed to this service. Each member is checked against
            the service branch before a record is created.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <ServiceDetail label="Branch">
              {service.branch ? (
                <>
                  <span>{service.branch.name}</span>
                  {service.branch.code && (
                    <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                      {service.branch.code}
                    </span>
                  )}
                </>
              ) : (
                "Unknown branch"
              )}
            </ServiceDetail>

            <ServiceDetail label="Date">
              {formatServiceDate(service.serviceDate)}
            </ServiceDetail>

            <ServiceDetail label="Start Time">
              {formatStartTime(service.startTime)}
            </ServiceDetail>

            <ServiceDetail label="Service Status">
              <StatusBadge variant={getServiceStatusVariant(service.status)}>
                {formatLabel(service.status)}
              </StatusBadge>
            </ServiceDetail>
          </div>
        </CardContent>
      </Card>

      {canScan && statusAllowsScanning ? (
        <QrAttendanceScanner serviceId={service.id} />
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title={getUnavailableTitle(canScan, service.status)}
          description={getUnavailableDescription(
            canScan,
            service.status,
          )}
          action={
            <Button asChild variant="outline">
              <Link href={`/portal/attendance/${service.id}`}>
                Back to Attendance
              </Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}

function ServiceDetail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

function getUnavailableTitle(canScan: boolean, status: string) {
  if (!canScan) return "View-only attendance access";
  if (status === "cancelled") return "Service cancelled";
  if (status === "completed") return "Scanning closed";
  return "Scanning unavailable";
}

function getUnavailableDescription(
  canScan: boolean,
  status: string,
) {
  if (!canScan) {
    return "Your account does not have attendance.record permission. You can still review this service's attendance records.";
  }

  if (status === "cancelled") {
    return "Cancelled services cannot accept attendance records.";
  }

  if (status === "completed") {
    return "QR attendance scanning closes when a service is completed. Use the attendance view for review or corrections permitted by your role.";
  }

  return "QR scanning is not available for the current service status.";
}

function getServiceStatusVariant(
  status: string,
): "success" | "warning" | "danger" | "muted" {
  if (status === "ongoing") return "success";
  if (status === "scheduled") return "warning";
  if (status === "cancelled") return "danger";
  return "muted";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map(
      (part) => part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function formatServiceDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
}

function formatStartTime(value: string | null) {
  if (!value) return "Not specified";

  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(
    "en-PH",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function QrAttendanceLoading() {
  return (
    <PageContainer>
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-[620px] rounded-2xl" />
    </PageContainer>
  );
}
