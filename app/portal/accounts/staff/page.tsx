import { Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";

import AccountsTabs from "../AccountsTabs";
import StaffAccountsTable, {
  type StaffAccount,
  type StaffAccountStatus,
  type StaffBranch,
  type StaffRoleSummary,
} from "./StaffAccountsTable";
import { requireAccountsPermission } from "../access";
import {
  KeyRound,
  UserPlus,
  UserRoundCog,
} from "lucide-react";

type AuthUser = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  invited_at?: string;
  banned_until?: string;
  deleted_at?: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  archived_at: string | null;
};

type BranchRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type BranchAccessRow = {
  user_id: string;
  church_branch_id: string;
};

type StaffRoleRow = {
  key: string;
  display_name: string | null;
  is_staff: boolean;
  is_active: boolean;
};

export default function StaffAccountsPage() {
  return (
    <Suspense fallback={<StaffAccountsSkeleton />}>
      <StaffAccountsContent />
    </Suspense>
  );
}

async function StaffAccountsContent() {
  const access = await requireAccountsPermission("accounts.view");

  const admin = createAdminClient();

  const [
    { data: staffRoleLinks, error: roleError },
    { data: profileRows, error: profileError },
    { data: branchRows, error: branchError },
    { data: branchAccessRows, error: branchAccessError },
    authUsers,
  ] = await Promise.all([
    admin
      .from("user_roles")
      .select(`
        user_id,
        roles!inner (
          key,
          display_name,
          is_staff,
          is_active
        )
      `)
      .eq("roles.is_staff", true)
      .eq("roles.is_active", true),

    admin
      .from("profiles")
      .select("id, display_name, archived_at"),

    admin
      .from("church_branches")
      .select("id, name, is_active")
      .order("name"),

    admin
      .from("user_branch_access")
      .select("user_id, church_branch_id"),

    listAllAuthUsers(admin),
  ]);

  if (roleError) throw new Error(roleError.message);
  if (profileError) throw new Error(profileError.message);
  if (branchError) throw new Error(branchError.message);
  if (branchAccessError) {
    throw new Error(branchAccessError.message);
  }

  const roleMap = new Map<string, StaffRoleSummary[]>();

  for (const link of staffRoleLinks ?? []) {
    const roles = link.roles as
      | StaffRoleRow
      | StaffRoleRow[]
      | null;

    const role = !roles
      ? null
      : Array.isArray(roles)
        ? roles[0] ?? null
        : roles;

    if (!role || !role.is_staff || !role.is_active || !role.key) {
      continue;
    }

    const roleSummary: StaffRoleSummary = {
      key: role.key,
      displayName: role.display_name?.trim() || formatRole(role.key),
    };

    const existing = roleMap.get(link.user_id) ?? [];

    if (!existing.some((item) => item.key === roleSummary.key)) {
      existing.push(roleSummary);
    }

    roleMap.set(link.user_id, existing);
  }

  const profileMap = new Map<string, ProfileRow>(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const branches: StaffBranch[] = (
    (branchRows ?? []) as BranchRow[]
  ).map((branch) => ({
    id: branch.id,
    name: branch.name,
    isActive: branch.is_active,
  }));

  const branchMap = new Map(
    branches.map((branch) => [branch.id, branch]),
  );

  const branchIdsByUser = new Map<string, Set<string>>();

  for (const assignment of (branchAccessRows ?? []) as BranchAccessRow[]) {
    const assignedBranchIds =
      branchIdsByUser.get(assignment.user_id) ?? new Set<string>();

    assignedBranchIds.add(assignment.church_branch_id);
    branchIdsByUser.set(
      assignment.user_id,
      assignedBranchIds,
    );
  }

  const staffAccounts: StaffAccount[] = authUsers
    .filter((user) => roleMap.has(user.id))
    .map((user) => {
      const roles = roleMap.get(user.id) ?? [];
      const profile = profileMap.get(user.id);
      const branchAccess = Array.from(
        branchIdsByUser.get(user.id) ?? [],
      )
        .map((branchId) => branchMap.get(branchId))
        .filter(
          (branch): branch is StaffBranch => Boolean(branch),
        );

      return {
        id: user.id,
        displayName: profile?.display_name ?? null,
        email: user.email ?? "No email",
        roles,
        branchAccess,
        hasAllBranchAccess: roles.some(
          (role) => role.key === "system_admin",
        ),
        status: getAccountStatus({
          archivedAt: profile?.archived_at ?? null,
          deletedAt: user.deleted_at ?? null,
          bannedUntil: user.banned_until ?? null,
          invitedAt: user.invited_at ?? null,
          emailConfirmedAt: user.email_confirmed_at ?? null,
        }),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      };
    });

  const totalAccounts = staffAccounts.length;

  const totalRoleAssignments = staffAccounts.reduce(
    (total, account) => total + account.roles.length,
    0,
  );
  const canInvite = hasPermission(
    access.permissions,
    "accounts.invite",
  );
  const canArchive = hasPermission(
    access.permissions,
    "accounts.archive",
  );
  const canRestore = hasPermission(
    access.permissions,
    "accounts.restore",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account Management"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title="Staff Accounts"
        description="Manage login accounts assigned to staff roles."
        action={
          canInvite ? (
            <Button asChild>
              <Link href="/portal/accounts/staff/new">
                <UserPlus />
                New Staff Account
              </Link>
            </Button>
          ) : undefined
        }
      />

      <AccountsTabs />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <UserRoundCog className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Staff Accounts
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264]">
              {totalAccounts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500">
              <KeyRound className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Assigned Roles
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264]">
              {totalRoleAssignments}
            </p>
          </CardContent>
        </Card>
      </div>

      <StaffAccountsTable
        accounts={staffAccounts}
        branches={branches}
        canArchive={canArchive}
        canRestore={canRestore}
      />
    </PageContainer>
  );
}

function formatRole(role: string) {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function getAccountStatus({
  archivedAt,
  deletedAt,
  bannedUntil,
  invitedAt,
  emailConfirmedAt,
}: {
  archivedAt: string | null;
  deletedAt: string | null;
  bannedUntil: string | null;
  invitedAt: string | null;
  emailConfirmedAt: string | null;
}): StaffAccountStatus {
  // Precedence: Deleted > Archived > Banned > Invited > Unconfirmed > Active.
  if (deletedAt) return "deleted";
  if (archivedAt) return "archived";

  if (bannedUntil) {
    const bannedUntilTime = Date.parse(bannedUntil);

    if (
      Number.isFinite(bannedUntilTime) &&
      bannedUntilTime > Date.now()
    ) {
      return "banned";
    }
  }

  if (!emailConfirmedAt && invitedAt) return "invited";
  if (!emailConfirmedAt) return "unconfirmed";

  return "active";
}

async function listAllAuthUsers(
  admin: ReturnType<typeof createAdminClient>,
): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

function StaffAccountsSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-11 w-72 rounded-xl" />

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[1200px]">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="grid grid-cols-8 gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-8 items-center gap-4 px-4 py-4"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-44" />

                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
