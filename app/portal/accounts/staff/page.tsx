import { Suspense } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";

import AccountsTabs from "../AccountsTabs";
import {
  KeyRound,
  UserRoundCog,
} from "lucide-react";

export default function StaffAccountsPage() {
  return (
    <Suspense fallback={<StaffAccountsSkeleton />}>
      <StaffAccountsContent />
    </Suspense>
  );
}

async function StaffAccountsContent() {
  await requirePortalTab("accounts");

  const admin = createAdminClient();

  const { data: staffRoleLinks, error: roleError } = await admin
    .from("user_roles")
    .select(`
      user_id,
      roles!inner (
        name
      )
    `)
    .neq("roles.name", "member");

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roleMap = new Map<string, string[]>();

  for (const link of staffRoleLinks ?? []) {
    const roles = link.roles as
      | { name: string }
      | { name: string }[]
      | null;

    const roleName = !roles
      ? null
      : Array.isArray(roles)
        ? roles[0]?.name ?? null
        : roles.name;

    if (!roleName) continue;

    const existing = roleMap.get(link.user_id) ?? [];

    if (!existing.includes(roleName)) {
      existing.push(roleName);
    }

    roleMap.set(link.user_id, existing);
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.listUsers();

  if (authError) {
    throw new Error(authError.message);
  }

  const staffAccounts = authData.users
    .filter((user) => roleMap.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email ?? "No email",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      roles: roleMap.get(user.id) ?? [],
    }));

  const totalAccounts = staffAccounts.length;

  const totalRoleAssignments = staffAccounts.reduce(
    (total, account) => total + account.roles.length,
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account Management"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title="Staff Accounts"
        description="Manage login accounts assigned to staff roles."
      />

      <AccountsTabs />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <UserRoundCog className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Staff Accounts
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264] dark:text-slate-100">
              {totalAccounts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <KeyRound className="h-4 w-4" />

              <p className="text-xs font-medium uppercase tracking-wide">
                Assigned Roles
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-[#203264] dark:text-slate-100">
              {totalRoleAssignments}
            </p>
          </CardContent>
        </Card>
      </div>

      {staffAccounts.length === 0 ? (
        <EmptyState
          icon={<UserRoundCog className="h-5 w-5" />}
          title="No staff accounts found"
          description="Staff accounts will appear here once staff roles are assigned."
        />
      ) : (
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {staffAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <span className="font-medium text-[#203264] dark:text-slate-100">
                    {account.email}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {account.roles.map((role) => (
                      <StatusBadge key={role} variant="info">
                        {formatRole(role)}
                      </StatusBadge>
                    ))}
                  </div>
                </TableCell>

                <TableCell className="text-slate-600 dark:text-slate-400">
                  {formatDate(account.lastSignInAt)}
                </TableCell>

                <TableCell className="text-slate-600 dark:text-slate-400">
                  {formatDate(account.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-[760px]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-4 items-center gap-4 px-4 py-4"
              >
                <Skeleton className="h-4 w-44" />

                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
