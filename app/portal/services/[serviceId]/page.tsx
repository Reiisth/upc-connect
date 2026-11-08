import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Pencil, ClipboardCheck } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import { requireServicesPermission } from "../access";
import { effectiveStoredServiceStatus } from "../lifecycle";
import ServiceLifecycleActions from "../ServiceLifecycleActions";
import ServiceStatusIcon from "../ServiceStatusIcon";

type Props = { params: Promise<{ serviceId: string }> };
export default function ServicePage(props: Props) {
  return <Suspense fallback={<Skeleton className="h-64" />}><Content {...props} /></Suspense>;
}

async function Content({ params }: Props) {
  const access = await requireServicesPermission("services.view");
  const { serviceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) notFound();
  const admin = createAdminClient();
  let query = admin.from("services").select("id,name,service_type,service_date,start_time,ended_at,status,church_branch_id,notes,branch:church_branches(name)").eq("id", serviceId);
  if (!access.isSystemAdmin) {
    if (!access.branchIds.length) notFound();
    query = query.in("church_branch_id", access.branchIds);
  }
  const { data: service, error } = await query.maybeSingle();
  if (error) throw new Error("Unable to load this service.");
  if (!service) notFound();
  const status = effectiveStoredServiceStatus(service);
  const branch = Array.isArray(service.branch) ? service.branch[0] : service.branch;
  const { data: type } = await admin.from("service_types").select("name").eq("key", service.service_type).maybeSingle();
  const canViewAttendance = hasPermission(access.permissions, "attendance.view");
  const attendanceCounts = { present: 0, absent: 0, excused: 0 };
  if (canViewAttendance) {
    await Promise.all((["present", "absent", "excused"] as const).map(async attendanceStatus => {
      const { count, error: attendanceError } = await admin.from("attendance_records").select("id", { count: "exact", head: true }).eq("service_id", service.id).eq("attendance_status", attendanceStatus);
      if (attendanceError) throw new Error("Unable to load service attendance.");
      attendanceCounts[attendanceStatus] = count ?? 0;
    }));
  }
  const start = service.start_time ? new Date(`${service.service_date}T${service.start_time}+08:00`) : null;
  const end = service.ended_at ? new Date(service.ended_at) : null;
  const minutes = start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : null;
  const duration = minutes === null ? (status === "ongoing" ? "In progress" : "Not recorded") : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const canEdit = hasPermission(access.permissions, "services.update");
  return <PageContainer>
    <PageHeader eyebrow="Services" eyebrowIcon={<CalendarDays className="h-4 w-4" />} title={service.name} description={type?.name ?? service.service_type} backHref="/portal/services" backLabel="Back to Services" />
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <ServiceStatusIcon status={status} expanded />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
      {canEdit && status === "scheduled" && <Button size="icon" variant="ghost" asChild><Link href={`/portal/services/${service.id}/edit`} title="Edit Service" aria-label="Edit Service"><Pencil aria-hidden="true" /></Link></Button>}
      {canEdit && <ServiceLifecycleActions id={service.id} status={status} toolbar />}
      {hasPermission(access.permissions, "attendance.view") && <Button size="icon" variant="ghost" asChild><Link href={`/portal/attendance/${service.id}`} title={status === "ongoing" ? "Manage Attendance" : "View Attendance History"} aria-label={status === "ongoing" ? "Manage Attendance" : "View Attendance History"}><ClipboardCheck aria-hidden="true" /></Link></Button>}
    </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-slate-500">Branch</dt><dd>{branch?.name ?? "Unknown branch"}</dd></div>
        <div><dt className="text-sm text-slate-500">Date</dt><dd>{new Date(`${service.service_date}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</dd></div>
        <div><dt className="text-sm text-slate-500">Start time (Asia/Manila)</dt><dd>{service.start_time ? new Date(`2000-01-01T${service.start_time}+08:00`).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "Not set"}</dd></div>
        <div><dt className="text-sm text-slate-500">End time (Asia/Manila)</dt><dd>{end ? end.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : status === "ongoing" ? "In progress" : "Not recorded"}</dd></div>
        <div><dt className="text-sm text-slate-500">Duration</dt><dd className="text-xl font-semibold text-[#203264]">{duration}</dd><p className="text-xs text-slate-500">From scheduled start to recorded completion.</p></div>
        {canViewAttendance && <div><dt className="text-sm text-slate-500">Attended (Present)</dt><dd className="text-3xl font-semibold text-green-700">{attendanceCounts.present.toLocaleString("en-PH")}</dd></div>}
        {canViewAttendance && <div><dt className="text-sm text-slate-500">Absent</dt><dd className="text-3xl font-semibold text-red-700">{attendanceCounts.absent.toLocaleString("en-PH")}</dd></div>}
        {canViewAttendance && <div><dt className="text-sm text-slate-500">Excused</dt><dd className="text-3xl font-semibold text-amber-700">{attendanceCounts.excused.toLocaleString("en-PH")}</dd></div>}
      </dl>
      {service.notes && <p className="whitespace-pre-wrap text-sm text-slate-600">{service.notes}</p>}
    </CardContent></Card>
  </PageContainer>;
}
