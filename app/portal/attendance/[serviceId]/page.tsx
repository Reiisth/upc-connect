import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClipboardCheck, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { hasPermission } from "@/lib/permissions";
import { canRecordServiceAttendance, canCorrectServiceAttendance } from "../../services/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAttendancePermission } from "../access";
import { loadAccessibleService, loadAttendanceRows } from "../data";
import AttendanceView from "../AttendanceView";
import {
  canScanServiceStatus,
  getAttendanceSummary,
} from "../types";

type AttendanceServicePageProps = {
  params: Promise<{
    serviceId: string;
  }>;
};

export default function AttendanceServicePage(
  props: AttendanceServicePageProps,
) {
  return (
    <Suspense fallback={<AttendanceServiceLoading />}>
      <AttendanceServiceContent {...props} />
    </Suspense>
  );
}

async function AttendanceServiceContent({
  params,
}: AttendanceServicePageProps) {
  const access = await requireAttendancePermission(
    "attendance.view",
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

  const loadedRows = service.status === "scheduled" ? [] : await loadAttendanceRows(admin, service);
  const rows = service.status === "completed" || service.status === "cancelled" ? loadedRows.filter(row => row.attendance !== null) : loadedRows;
  const summary = getAttendanceSummary(rows);
  const canRecord = canRecordServiceAttendance(service.status) && hasPermission(
    access.permissions,
    "attendance.record",
  );
  const canCorrect = canCorrectServiceAttendance(service.status) && hasPermission(
    access.permissions,
    "attendance.correct",
  );
  const { data: visitingBranches, error: branchError } = canRecord
    ? await admin.from("church_branches").select("id,name").order("name")
    : { data: [], error: null };
  if (branchError) throw new Error("Unable to load visiting member branches.");
  const canScan =
    canRecord &&
    canScanServiceStatus(service.status);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/attendance"
        backLabel="Back to Attendance"
        eyebrow="Attendance"
        eyebrowIcon={<ClipboardCheck className="h-4 w-4" />}
        title={service.name}
        description={service.status === "ongoing" ? "Review and record attendance for this Ongoing Service." : service.status === "scheduled" ? "Upcoming Service information. Attendance opens at the start time." : "Read-only recorded attendance history for this Service."}
        action={
          canScan ? (
            <Button asChild>
              <Link href={`/portal/attendance/${service.id}/scan`}>
                <QrCode />
                Scan QR Attendance
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <ServiceDetail label="Branch">
              {service.branch ? (
                <>
                  <span>{service.branch.name}</span>
                  {service.branch.code && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
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

            <ServiceDetail label="Status">
              <StatusBadge variant={getServiceStatusVariant(service.status)}>
                {formatLabel(service.status)}
              </StatusBadge>
            </ServiceDetail>
          </div>

          {service.notes && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {service.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {service.status === "cancelled" && summary.totalRecorded > 0 && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This cancelled service has recorded attendance. Its history is preserved
          and read-only; cancelled services are excluded from attendance analytics
          and inactivity calculations.
        </p>
      )}

      {service.status === "scheduled" ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">This Service has not started. Attendance opens at its Manila start time; refresh then to open the roster.</p> : <AttendanceView
        serviceId={service.id}
        visitingBranches={visitingBranches ?? []}
        serviceBranchId={service.churchBranchId}
        rows={rows}
        summary={summary}
        canRecord={canRecord}
        canCorrect={canCorrect}
      />}
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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-slate-900">
        {children}
      </div>
    </div>
  );
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

function AttendanceServiceLoading() {
  return (
    <PageContainer>
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-[420px] rounded-2xl" />
    </PageContainer>
  );
}
