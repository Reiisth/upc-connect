import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAttendancePermission } from "../../access";
import { loadAccessibleService, loadRecentQrScans } from "../../data";
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

  const serviceDetails = (
<div className="space-y-2 text-center">
        <h2 className="font-radio-canada text-lg font-semibold text-[#203264] sm:text-xl">{service.name}</h2>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500"><StatusBadge variant={getServiceStatusVariant(service.status)}>{formatLabel(service.status)}</StatusBadge><span>{service.branch?.name} · {formatServiceDate(service.serviceDate)} · {formatStartTime(service.startTime)}</span></div>
      </div>
  );

  return (
    <PageContainer className="space-y-4 sm:space-y-6">
      <PageHeader eyebrow="Attendance" eyebrowIcon={<ClipboardCheck className="h-4 w-4"/>}
        backHref={`/portal/attendance/${service.id}`} backLabel="Back to Service Attendance"
        title="QR Attendance Scanner" description="Scan a Member QR code to record Present attendance for this Service."
        className="space-y-2 sm:space-y-4 [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_p]:mt-1" />


      {canScan && statusAllowsScanning ? (
        <QrAttendanceScanner key={service.id} serviceId={service.id} serviceDetails={serviceDetails} initialRecent={await loadRecentQrScans(admin,service)} />
      ) : (
        <div className="space-y-4">{serviceDetails}<EmptyState
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
        /></div>
      )}
    </PageContainer>
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
    return "QR attendance scanning closes when a service is completed. Its history is read-only.";
  }

  return "Attendance opens when the Service start time is reached. Refresh then to scan.";
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
