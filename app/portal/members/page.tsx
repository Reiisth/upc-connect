import { Suspense } from "react";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import MembersSkeleton from "./MembersSkeleton";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";
import MembersTable from "./MembersTable";
import { getMemberAccess } from "@/lib/portal-access";



export default function PortalMembersPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersPageContent />
    </Suspense>
  );
}

async function MembersPageContent() {
  const { roles, branches } = await requirePortalTab("members");
  const isSystemAdmin = roles.includes("system_admin");

  const branchIds = branches.map((branch) => branch.id);
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
        <div className="rounded-2xl border bg-white p-6">
          <p className="text-sm text-slate-500">
            You are not assigned to any church branch.
          </p>
        </div>
      );
    }

    membersQuery = membersQuery.in("church_branch_id", branchIds);
  }

  const { data: members, error } = await membersQuery.order(
    "created_at",
    { ascending: false },
  );

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
      (member) => member.account_status === "connected",
    ).length ?? 0;

  const incompleteProfiles =
    members?.filter(
      (member) => member.profile_status !== "completed",
    ).length ?? 0;

  const normalizedMembers =
    members?.map((member) => ({
      ...member,

      department: Array.isArray(member.department)
        ? member.department[0] ?? null
        : member.department ?? null,

      church_branch: Array.isArray(member.church_branch)
        ? member.church_branch[0] ?? null
        : member.church_branch ?? null,
    })) ?? [];

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#5D94E8]">
            <UsersRound className="h-4 w-4" />

            <p className="text-sm font-medium">
              Member Management
            </p>
          </div>

          <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
            Members
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage church member records, account connections,
            and profile completion.
          </p>
        </div>

        {canManageMembers && (
          <Link
            href="/portal/members/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#203264] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2C447D] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create Member
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Total Members
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-[#203264]">
            {totalMembers}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Active Members
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-emerald-700">
            {activeMembers}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Connected
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-green-700">
            {connectedMembers}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Incomplete
          </p>

          <p className="mt-2 font-heading text-2xl font-semibold text-amber-700">
            {incompleteProfiles}
          </p>
        </div>
      </div>

      <MembersTable
        members={normalizedMembers}
        canManage={canManageMembers}
      />
    </main>
  );
}