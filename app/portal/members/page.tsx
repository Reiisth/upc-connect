import { Suspense } from "react";
import Link from "next/link";
import {
  CircleCheckBig,
  CircleUserRound,
  Plus,
  UserCheck,
  UsersRound,
} from "lucide-react";

import MembersSkeleton from "./MembersSkeleton";
import MembersTable from "./MembersTable";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { getMemberAccess } from "@/lib/portal-access";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export default function PortalMembersPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersPageContent />
    </Suspense>
  );
}

async function MembersPageContent() {
  const {
    roles,
    branchIds,
    isSystemAdmin,
  } = await requirePortalTab("members");

  const memberAccess = getMemberAccess(roles);
  const canManageMembers = memberAccess === "manage";

  const admin = createAdminClient();

  let membersQuery = admin
    .from("members")
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      nickname,
      birth_date,
      gender,
      phone_number,
      email,
      zone,
      civil_status,
      street_address,
      barangay,
      city,
      province,
      country,
      photo_url,
      position,
      member_status,
      account_status,
      profile_status,
      created_at,
      department:departments (
        name
      ),
      church_branch:church_branches (
        name
      )
    `)
    .eq("is_archived", false);

  if (!isSystemAdmin) {
    if (branchIds.length === 0) {
      return (
        <PageContainer>
          <PageHeader
            eyebrow="Member Management"
            eyebrowIcon={<UsersRound className="h-4 w-4" />}
            title="Members"
            description="Manage church member records, account connections, and profile completion."
          />

          <EmptyState
            icon={<UsersRound className="h-5 w-5" />}
            title="No branch assigned"
            description="Your account is not currently assigned to a church branch."
          />
        </PageContainer>
      );
    }

    membersQuery = membersQuery.in(
      "church_branch_id",
      branchIds,
    );
  }

  const { data: members, error } =
    await membersQuery.order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const totalMembers = members?.length ?? 0;

  const activeMembers =
    members?.filter(
      (member) => member.member_status === "active",
    ).length ?? 0;

  const connectedMembers =
    members?.filter(
      (member) =>
        member.account_status === "connected",
    ).length ?? 0;

  const incompleteProfiles =
    members?.filter(
      (member) =>
        member.profile_status !== "completed",
    ).length ?? 0;

  const normalizedMembers =
    members?.map((member) => ({
      ...member,

      department: Array.isArray(member.department)
        ? member.department[0] ?? null
        : member.department ?? null,

      church_branch: Array.isArray(
        member.church_branch,
      )
        ? member.church_branch[0] ?? null
        : member.church_branch ?? null,
    })) ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Member Management"
        eyebrowIcon={<UsersRound className="h-4 w-4" />}
        title="Members"
        description="Manage church member records, account connections, and profile completion."
        action={
          canManageMembers ? (
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
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />

        <MemberStatCard
          label="Connected"
          value={connectedMembers}
          icon={<CircleCheckBig />}
          valueClassName="text-green-700 dark:text-green-400"
        />

        <MemberStatCard
          label="Incomplete"
          value={incompleteProfiles}
          icon={<CircleUserRound />}
          valueClassName="text-amber-700 dark:text-amber-400"
        />
      </div>

      <MembersTable
        members={normalizedMembers}
        canManage={canManageMembers}
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
  valueClassName = "text-[#203264] dark:text-slate-100",
}: MemberStatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${valueClassName}`}
          >
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] dark:bg-slate-800 dark:text-slate-200 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      </div>
    </Card>
  );
}