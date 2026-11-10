import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import Link from "next/link";
import {
  CircleCheckBig,
  CircleUserRound,
  Plus,
  UserCheck,
  UsersRound,
} from "lucide-react";

import MembersTable from "./MembersTable";
import { requireMembersPermission } from "./access";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseMemberListFilters, type MemberListSearch, memberSearchWords } from "./list-filters";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function PortalMembersPage(props: {searchParams?: Promise<MemberListSearch>}) {
  return (
    <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="members" />}>
      <MembersPageContent {...props} />
    </Suspense>
  );
}

async function MembersPageContent({searchParams}: {searchParams?: Promise<MemberListSearch>}) {
  // Resolve Next's live URL promise before serializing private-cache arguments.
  return CachedMembersPageContent({ searchParams: await searchParams });
}

async function CachedMembersPageContent({searchParams}: {searchParams?: MemberListSearch}) {
  "use cache: private";
  cacheLife({ stale: 120 });
  cacheTag("portal:members");
  const access = await requireMembersPermission("members.view");
  const { branchIds, isSystemAdmin } = access;
  const canCreate = hasPermission(
    access.permissions,
    "members.create",
  );
  const canArchive = hasPermission(
    access.permissions,
    "members.archive",
  );
  const canLinkAccount = hasPermission(
    access.permissions,
    "members.link_account",
  );

  const admin = createAdminClient();

  if (!isSystemAdmin && !branchIds.length) return <PageContainer><PageHeader title="Members" eyebrow="Member Management" /><EmptyState title="No branch assigned" description="Your account is not currently assigned to a church branch." /></PageContainer>;
  const filters = parseMemberListFilters(searchParams);
  function scopedQuery() {
    const query = admin.from("members");
    return query;
  }
  const branchQuery = admin.from("church_branches").select("id,name").order("name");
  const branchResult = await (isSystemAdmin ? branchQuery : branchQuery.in("id", branchIds));
  if (branchResult.error) throw new Error("Unable to load member branches.");
  const branches = branchResult.data ?? [];
  if (filters.branch !== "all" && !branches.some(branch => branch.id === filters.branch)) redirect("/access-denied");
  const count = (column?: string, value?: string) => {
    let query = scopedQuery().select("id", {count:"exact",head:true});
    if (!isSystemAdmin) query = query.in("church_branch_id",branchIds);
    if (column !== "any") query = query.eq("is_archived",false);
    if (column && column !== "any") query = query.eq(column,value);
    return query;
  };
  const list = () => {
    let query = scopedQuery().select("id,first_name,middle_name,last_name,member_status,account_status,profile_status,is_archived,created_at,church_branch:church_branches(id,name)", {count:"exact"});
    if (!isSystemAdmin) query = query.in("church_branch_id",branchIds);
    if (filters.branch !== "all") query = query.eq("church_branch_id",filters.branch);
    if (filters.archive !== "all") query = query.eq("is_archived",filters.archive === "archived");
    for (const [column,value] of [["member_status",filters.status],["account_status",filters.account],["profile_status",filters.profile]]) if (value !== "all") query = query.eq(column,value);
    for (const word of memberSearchWords(filters.search)) query = query.or(["first_name","middle_name","last_name","member_status","account_status","profile_status"].map(column => `${column}.ilike.%${word}%`).join(","));
    if (filters.sort.startsWith("name_")) query = query.order("first_name",{ascending:filters.sort === "name_asc"}).order("middle_name",{ascending:filters.sort === "name_asc",nullsFirst:true}).order("last_name",{ascending:filters.sort === "name_asc"});
    else if (filters.sort === "active_first" || filters.sort === "inactive_first") query = query.order("member_status",{ascending:filters.sort === "active_first"});
    else query = query.order("created_at",{ascending:filters.sort === "oldest"});
    return query.order("id");
  };
  const [rows, total, active, connected, incomplete, source] = await Promise.all([
    list().range((filters.page-1)*10,filters.page*10-1), count(), count("member_status","active"), count("account_status","connected"), count("profile_status","incomplete"), count("any"),
  ]);
  for (const result of [rows,total,active,connected,incomplete,source]) if (result.error) throw new Error("Unable to load member list.");
  const pageCount = Math.max(1,Math.ceil((rows.count ?? 0)/10));
  if (filters.page > pageCount) {
    filters.page = pageCount;
    const last = await list().range((filters.page-1)*10,filters.page*10-1);
    if (last.error) throw new Error("Unable to load member page.");
    rows.data = last.data;
  }
  const totalMembers = total.count ?? 0, activeMembers = active.count ?? 0, connectedMembers = connected.count ?? 0, incompleteProfiles = incomplete.count ?? 0;
  const normalizedMembers = (rows.data ?? []).map(member => ({...member, church_branch: Array.isArray(member.church_branch) ? member.church_branch[0] ?? null : member.church_branch ?? null}));
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Member Management"
        eyebrowIcon={<UsersRound className="h-4 w-4" />}
        title="Members"
        description="Manage church member records, account connections, and profile completion."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/portal/members/new">
                <Plus />
                Create Member
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MemberStatCard
          label="Total Members"
          value={totalMembers}
          icon={<UsersRound />}
        />

        <MemberStatCard
          label="Active Members"
          value={activeMembers}
          icon={<UserCheck />}
          valueClassName="text-emerald-700"
        />

        <MemberStatCard
          label="Connected"
          value={connectedMembers}
          icon={<CircleCheckBig />}
          valueClassName="text-green-700"
        />

        <MemberStatCard
          label="Incomplete"
          value={incompleteProfiles}
          icon={<CircleUserRound />}
          valueClassName="text-amber-700"
        />
      </div>

      <MembersTable
        members={normalizedMembers}
        paging={{total: rows.count ?? 0, sourceCount: source.count ?? 0, filters, branches}}
        canArchive={canArchive}
        canLinkAccount={canLinkAccount}
      />
    </PageContainer>
  );
}

type MemberStatCardProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
};

function MemberStatCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264]",
}: MemberStatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${valueClassName}`}
          >
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      </div>
    </Card>
  );
}
