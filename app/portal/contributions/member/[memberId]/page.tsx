import { memberHistoryNavigation } from "@/lib/member-history-navigation";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, HandCoins, MapPin, Wallet, Pencil } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionButton } from "@/components/ui/table-action-button";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleActiveBranches } from "../../../services/access";
import { requireContributionsPermission } from "../../access";
import { contributionAmountToCents, formatContributionAmount, formatContributionType } from "../../types";

type Props = { params: Promise<{ memberId: string }>; searchParams: Promise<{ page?: string | string[]; returnTo?: string | string[] }> };
export default function MemberContributionsPage(props: Props) {
  return <Suspense fallback={<Skeleton className="h-64" />}><Content {...props} /></Suspense>;
}
function money(cents: bigint) {
  return `₱${(cents / BigInt(100)).toLocaleString("en-PH")}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
}
async function Content({ params, searchParams }: Props) {
  const access = await requireContributionsPermission("contributions.view");
  const { memberId } = await params;
  const navigationParams = await searchParams;
  const navigation = memberHistoryNavigation(memberId, navigationParams?.returnTo, "/portal/contributions", "Back to Contributions");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(memberId)) notFound();
  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(access, admin);
  if (!branches.length) notFound();
  const ids = branches.map(branch => branch.id);
  const readPage = (from: number) => admin.from("financial_contributions")
    .select("id,amount,contribution_type,contribution_date,payment_method,church_branch_id,notes")
    .eq("contributor_type", "member").eq("member_id", memberId).in("church_branch_id", ids)
    .order("contribution_date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 499);
  const { data: member, error: memberError } = await admin.from("members")
    .select("id,first_name,middle_name,last_name,church_branch_id,member_status,is_archived").eq("id", memberId).maybeSingle();
  if (memberError) throw new Error("Unable to load member contribution history.");
  if (!member) notFound();
  const { data: first, error } = await readPage(0);
  if (error) throw new Error("Unable to load member contributions.");
  const history = [...first ?? []];
  for (let from = 500; history.length === from; from += 500) {
    const { data, error } = await readPage(from);
    if (error) throw new Error("Unable to load member contributions.");
    history.push(...data ?? []);
  }
  const currentBranch = branches.find(branch => branch.id === member.church_branch_id);
  if (!currentBranch && !history.length) notFound();
  const showStatus = Boolean(currentBranch) && hasPermission(access.permissions, "members.view");
  const totals = { all: BigInt(0), tithe: BigInt(0), love_offering: BigInt(0), other: BigInt(0) };
  for (const record of history) {
    const cents = BigInt(contributionAmountToCents(record.amount));
    totals.all += cents;
    if (record.contribution_type === "tithe" || record.contribution_type === "love_offering" || record.contribution_type === "other") totals[record.contribution_type as "tithe" | "love_offering" | "other"] += cents;
  }
  const rawPage = (await searchParams).page;
  const pages = Math.max(1, Math.ceil(history.length / 10));
  const page = Math.min(pages, typeof rawPage === "string" && /^\d{1,6}$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1);
  const name = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" ");
  return <PageContainer>
    <PageHeader eyebrow="Contributions" eyebrowIcon={<HandCoins className="h-4 w-4" />} title="Member Contribution History" description="Recorded contributions within your branch access." backHref={navigation.backHref} backLabel={navigation.backLabel} />
    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div><div className="flex items-center gap-3">
        {showStatus && <span tabIndex={0} aria-label={`Member status: ${member.member_status ?? "unknown"}`} className={`group inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] ${member.member_status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
          <span className="h-3 w-3 rounded-full" aria-hidden="true" /><span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">{member.member_status === "active" ? "Active" : member.member_status === "inactive" ? "Inactive" : "Unknown"}</span>
        </span>}
        <h2 className="font-radio-canada text-2xl font-semibold text-[#203264] sm:text-3xl">{name}</h2>
      </div><p className="mt-2 text-sm text-slate-500">{currentBranch?.name ?? "Outside your branch access"}{showStatus && member.is_archived ? " · Archived member" : ""}</p></div>
      <dl className="grid gap-5 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {([['all', 'Total contributions'], ['tithe', 'Tithes'], ['love_offering', 'Love offerings'], ['other', 'Other']] as const).map(([key, label]) => <div key={key}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 break-words text-2xl font-bold tabular-nums text-[#203264] sm:text-3xl">{money(totals[key])}</dd></div>)}
      </dl><p className="text-xs text-slate-500">{history.length.toLocaleString("en-PH")} recorded contributions across accessible branches. Totals cover the full visible history.</p>
    </CardContent></Card>
    {!history.length ? <EmptyState title="No contributions recorded" description="No member contributions are available within your branch access." /> : <section aria-label="Member contribution records" className="space-y-3">
      {history.slice((page - 1) * 10, page * 10).map(record => <Card key={record.id}><CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#203264]"><CalendarDays className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />{new Date(`${record.contribution_date}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</span>
          <StatusBadge variant="info">{formatContributionType(record.contribution_type)}</StatusBadge></div><p className="text-xl font-bold tabular-nums text-[#203264]">{formatContributionAmount(record.amount)}</p></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{branches.find(branch => branch.id === record.church_branch_id)?.name}</span><span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />{formatContributionType(record.payment_method)}</span>
          {hasPermission(access.permissions, "contributions.update") && <TableActionButton href={`/portal/contributions/${record.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
        </div>{record.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{record.notes}</p>}
      </CardContent></Card>)}
      <nav aria-label="Contribution history pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, history.length)} of {history.length} records</p><div className="flex items-center gap-2">
        {page > 1 ? <Button variant="outline" size="sm" asChild><Link href={navigation.pageHref(page - 1)}>Previous</Link></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}<span className="text-sm text-slate-500">Page {page} of {pages}</span>{page < pages ? <Button variant="outline" size="sm" asChild><Link href={navigation.pageHref(page + 1)}>Next</Link></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}
      </div></nav>
    </section>}
  </PageContainer>;
}
