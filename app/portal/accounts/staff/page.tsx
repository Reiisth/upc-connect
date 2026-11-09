import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";

import AccountsTabs from "../AccountsTabs";
import StaffAccountsTable, {
  type StaffAccount,
  type StaffAccountStatus,
  type StaffBranch,
  type StaffRoleSummary,
} from "./StaffAccountsTable";
import { getAccountTargetScopes } from "../target-scope";
import { getAuthUsersByIds } from "../auth-users";
import { requireStaffAccountAccess } from "../access";
import {
  KeyRound,
  UserPlus,
  UserRoundCog,
} from "lucide-react";

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
    <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="accounts staff" />}>
      <StaffAccountsContent />
    </Suspense>
  );
}

async function StaffAccountsContent() {
  const access = await requireStaffAccountAccess();

  const admin = createAdminClient();
  const targets = await getAccountTargetScopes(access, admin);
  const visibleIds = [...targets.values()].filter((target) => target.canViewStaff).map((target) => target.userId);

  let branchQuery = admin.from("church_branches").select("id, name, code, is_active").order("name");
  if (!access.isSystemAdmin) branchQuery = branchQuery.in("id", access.branchIds);

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
      .eq("roles.is_active", true).in("user_id", visibleIds),

    admin
      .from("profiles")
      .select("id, display_name, archived_at").in("id", visibleIds),

    branchQuery,
    admin
      .from("user_branch_access")
      .select("user_id, church_branch_id").in("user_id", visibleIds),

    getAuthUsersByIds(admin, visibleIds),
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

  const staffAccounts: StaffAccount[] = [...authUsers.values()]
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
        canChangeAccount: targets.get(user.id)?.canChangeAccount ?? false,
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

      <AccountsTabs permissions={access.permissions} />

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
