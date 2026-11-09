import { PageSkeleton } from "@/components/ui/page-skeleton";
import { memberHistoryNavigation } from "@/lib/member-history-navigation";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, ClipboardCheck, ExternalLink, MapPin, QrCode, Pencil } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatManilaTimestamp } from "@/lib/manila-time";
import { getAccessibleActiveBranches } from "../../../services/access";
import { requireAttendancePermission } from "../../access";

type Props = { params: Promise<{ memberId: string }>; searchParams: Promise<{ page?: string | string[]; returnTo?: string | string[] }> };
export default function MemberAttendancePage(props: Props) {
  return <Suspense fallback={<PageSkeleton kind="history" fields={6} metrics={4} columns={5} label="attendance member" />}><Content {...props} /></Suspense>;
}

async function Content({ params, searchParams }: Props) {
  const access = await requireAttendancePermission("attendance.view");
  const { memberId } = await params;
  const navigationParams = await searchParams;
  const navigation = memberHistoryNavigation(memberId, navigationParams?.returnTo, "/portal/attendance", "Back to Attendance");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(memberId)) notFound();
  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(access, admin);
  if (!branches.length) notFound();
  const ids = branches.map(branch => branch.id);
  // Host-service branch scopes every history read, including after transfers.
  const historyQuery = () => admin.from("attendance_records")
    .select("id,attendance_status,check_in_time,method,service:services!inner(id,name,service_date,church_branch_id,status)", { count: "exact" })
    .eq("member_id", memberId).in("service.church_branch_id", ids);
  const { data: member, error: memberError } = await admin.from("members")
    .select("id,first_name,middle_name,last_name,church_branch_id,member_status,is_archived").eq("id", memberId).maybeSingle();
  if (memberError) throw new Error("Unable to load member attendance.");
  if (!member) notFound();
  const rawPage = (await searchParams).page;
  const requestedPage = typeof rawPage === "string" && /^\d{1,6}$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1;
  const { count, error: countError } = await historyQuery().limit(1);
  if (countError) throw new Error("Unable to load attendance history.");
  if (!ids.includes(member.church_branch_id ?? "") && !count) notFound();
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const page = Math.min(requestedPage, totalPages);
  const { data: records, error } = await historyQuery()
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }).range((page - 1) * 10, page * 10 - 1);
  if (error) throw new Error("Unable to load attendance history.");
  const counts = { present: 0, absent: 0, excused: 0 };
  await Promise.all((["present", "absent", "excused"] as const).map(async status => {
    const { count, error } = await historyQuery().eq("attendance_status", status).limit(1);
    if (error) throw new Error("Unable to load attendance summary.");
    counts[status] = count ?? 0;
  }));
  const currentBranch = branches.find(branch => branch.id === member.church_branch_id);
  const showMemberStatus = Boolean(currentBranch) && hasPermission(access.permissions ?? [], "members.view");
  const name = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
  return <PageContainer>
    <PageHeader eyebrow="Attendance" eyebrowIcon={<ClipboardCheck className="h-4 w-4" />} title="Member Attendance History" description="Recorded service attendance within your branch access." backHref={navigation.backHref} backLabel={navigation.backLabel} />
    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div>
        <div className="flex items-center gap-3">
          {showMemberStatus && <span tabIndex={0} aria-label={`Member status: ${member.member_status ?? "unknown"}`} className={`group inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] ${member.member_status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
            <span className="h-3 w-3 rounded-full" aria-hidden="true" />
            <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">{member.member_status === "active" ? "Active" : member.member_status === "inactive" ? "Inactive" : "Unknown"}</span>
          </span>}
          <h2 className="font-radio-canada text-2xl font-semibold text-[#203264] sm:text-3xl">{name}</h2>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" aria-hidden="true" />{currentBranch?.name ?? "Outside your branch access"}{showMemberStatus && member.is_archived ? " ? Archived member" : ""}</p>
      </div>
      <dl className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
        {([['present', 'Present', 'text-emerald-700'], ['absent', 'Absent', 'text-slate-600'], ['excused', 'Excused', 'text-blue-700']] as const).map(([key, label, color]) => <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className={`mt-2 text-4xl font-bold tabular-nums sm:text-5xl ${color}`}>{counts[key].toLocaleString("en-PH")}</dd>
        </div>)}
      </dl>
      <p className="text-xs text-slate-500">Recorded attendance only, across accessible services. Missing records are not counted as absences. Cancelled service records are retained in these history counts.</p>
    </CardContent></Card>
    {!total ? <EmptyState title="No attendance records" description="No recorded attendance is available in your branch scope." /> : <section aria-label="Member attendance records" className="space-y-3">
      {records?.map(record => {
        const service = Array.isArray(record.service) ? record.service[0] : record.service;
        if (!service) return null;
        const MethodIcon = record.method === "qr" ? QrCode : Pencil;
        return <Card key={record.id}><CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#203264]"><CalendarDays className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />{new Date(`${service.service_date}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</span>
              <span className="inline-flex items-center gap-1.5 text-slate-500"><MethodIcon className="h-4 w-4" aria-hidden="true" />{record.method === "qr" ? "QR" : "Manual"}</span>
            </div>
            <StatusBadge variant={record.attendance_status === "present" ? "success" : record.attendance_status === "excused" ? "info" : "muted"}>{record.attendance_status === "present" ? "Present" : record.attendance_status === "excused" ? "Excused" : "Absent"}</StatusBadge>
          </div>
          <Link href={`/portal/attendance/${service.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#203264] hover:underline">{service.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{branches.find(branch => branch.id === service.church_branch_id)?.name}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{record.check_in_time ? formatManilaTimestamp(record.check_in_time) : "No check-in time recorded"}</span>
          </div>
          {service.status === "cancelled" && <StatusBadge variant="muted">Cancelled service</StatusBadge>}
        </CardContent></Card>;
      })}
        <nav aria-label="Attendance history pagination" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} records</p>
          <div className="flex items-center gap-2">
            {page > 1 ? <Button variant="outline" size="sm" asChild><Link href={navigation.pageHref(page - 1)}>Previous</Link></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            {page < totalPages ? <Button variant="outline" size="sm" asChild><Link href={navigation.pageHref(page + 1)}>Next</Link></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}
          </div>
        </nav>
    </section>}
  </PageContainer>;
}
