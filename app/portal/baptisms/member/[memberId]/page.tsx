import { MemberStatus } from "@/components/ui/member-status";
import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { memberHistoryNavigation } from "@/lib/member-history-navigation";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, Droplets, Flame, MapPin, UserRound, Pencil } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionButton } from "@/components/ui/table-action-button";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleActiveBranches } from "../../../services/access";
import { requireBaptismPermission } from "../../access";
import { BAPTISM_TYPES, formatBaptismType } from "../../types";
import { getBaptismUpdatePermission } from "../../access";

type Props = { params: Promise<{ memberId: string }>; searchParams: Promise<{ returnTo?: string | string[] }> };
export default function MemberBaptismRecordsPage(props: Props) {
  return <Suspense fallback={<PageSkeleton kind="history" fields={6} metrics={4} columns={5} label="baptisms member" />}><Content {...props} /></Suspense>;
}
async function Content({ params, searchParams }: Props) {
  "use cache: private";
  cacheLife({ stale: 60 });
  cacheTag("portal:baptisms");
  const access = await requireBaptismPermission("baptisms.view");
  const { memberId } = await params;
  const navigationParams = await searchParams;
  const navigation = memberHistoryNavigation(memberId, navigationParams?.returnTo, "/portal/baptisms", "Back to Baptisms");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(memberId)) notFound();
  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(access, admin);
  if (!branches.length) notFound();
  const ids = branches.map(branch => branch.id);
  const { data: member, error: memberError } = await admin.from("members")
    .select("id,first_name,middle_name,last_name,church_branch_id,member_status,is_archived").eq("id", memberId).maybeSingle();
  if (memberError) throw new Error("Unable to load member baptism records.");
  if (!member) notFound();
  const { data: records, error } = await admin.from("baptism_records")
    .select("id,baptism_type,baptism_date,church_branch_id,officiated_by,location,notes")
    .eq("member_id", memberId).in("church_branch_id", ids).order("baptism_type");
  if (error) throw new Error("Unable to load member baptism records.");
  const history = records ?? [];
  const currentBranch = branches.find(branch => branch.id === member.church_branch_id);
  if (!currentBranch && !history.length) notFound();
  const showStatus = Boolean(currentBranch) && hasPermission(access.permissions, "members.view");
  const name = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
  return <PageContainer>
    <PageHeader eyebrow="Baptisms" eyebrowIcon={<Droplets className="h-4 w-4" />} title="Member Baptism Records" description="Water and Holy Ghost baptism records within your branch access." backHref={navigation.backHref} backLabel={navigation.backLabel} />
    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div><div className="flex items-center gap-3">
        {showStatus && <MemberStatus status={member.member_status} />}
        <h2 className="font-radio-canada text-2xl font-semibold text-[#203264] sm:text-3xl">{name}</h2>
      </div><p className="mt-2 text-sm text-slate-500">{currentBranch?.name ?? "Outside your branch access"}{showStatus && member.is_archived ? " · Archived member" : ""}</p></div>
      <dl className="grid gap-5 border-t border-slate-200 pt-4 sm:grid-cols-2">
        {BAPTISM_TYPES.map(type => { const record = history.find(row => row.baptism_type === type); const Icon = type === "water" ? Droplets : Flame;
          return <div key={type}><dt className="flex items-center gap-2 text-sm font-semibold text-[#203264]"><Icon className={`h-5 w-5 ${type === "water" ? "text-sky-600" : "text-amber-600"}`} aria-hidden="true" />{formatBaptismType(type)} Baptism</dt><dd className="mt-2"><StatusBadge variant={record ? "success" : "muted"}>{record ? "Recorded" : "No accessible record"}</StatusBadge></dd></div>;
        })}
      </dl><p className="text-xs text-slate-500">Only records from accessible branches are shown. An unavailable record does not mean the member has not received that baptism.</p>
    </CardContent></Card>
    {!history.length ? <EmptyState title="No baptism records" description="No baptism records are available within your branch access." /> : <section aria-label="Member baptism records" className="space-y-3">
      {history.map(record => { const Icon = record.baptism_type === "water" ? Droplets : Flame; const updatePermission = getBaptismUpdatePermission(record.baptism_type);
        return <Card key={record.id}><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold text-[#203264]"><Icon className={`h-5 w-5 ${record.baptism_type === "water" ? "text-sky-600" : "text-amber-600"}`} aria-hidden="true" />{formatBaptismType(record.baptism_type)} Baptism</h3>
            {updatePermission && hasPermission(access.permissions, updatePermission) && <TableActionButton href={`/portal/baptisms/${record.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#203264]"><CalendarDays className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />{record.baptism_date ? new Date(`${record.baptism_date}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }) : "Date not recorded"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{branches.find(branch => branch.id === record.church_branch_id)?.name}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />Officiated by: {record.officiated_by || "Not recorded"}</span>
            {record.location && <span>Location: {record.location}</span>}
          </div>{record.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{record.notes}</p>}
        </CardContent></Card>;
      })}
    </section>}
  </PageContainer>;
}
