import { Suspense } from "react";
import { UsersRound } from "lucide-react";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";

export default function StaffBranchAccessPage() {
  return (
    <Suspense fallback={<StaffBranchAccessLoading />}>
      <StaffBranchAccessContent />
    </Suspense>
  );
}

async function StaffBranchAccessContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <PageContainer>
        <EmptyState
          title="Access denied"
          description="You do not have permission to manage staff branch access."
        />
      </PageContainer>
    );
  }

  const admin = createAdminClient();

  const [
    { data: staff, error: staffError },
    { data: branches, error: branchesError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(`
        id,
        display_name,
        user_roles (
          role:roles (
            name
          )
        )
      `),

    admin
      .from("church_branches")
      .select(`
        id,
        name,
        code,
        is_active
      `)
      .eq("is_active", true)
      .order("name"),

    admin
      .from("user_branch_access")
      .select(`
        user_id,
        church_branch_id
      `),
  ]);

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const staffUsers =
    staff
      ?.map((profile) => {
        const roleNames =
          profile.user_roles?.flatMap((item) => {
            const role = Array.isArray(item.role)
              ? item.role[0] ?? null
              : item.role ?? null;

            return role?.name ? [role.name] : [];
          }) ?? [];

        return {
          id: profile.id,
          display_name: profile.display_name,
          roles: roleNames,
        };
      })
      .filter((profile) =>
        profile.roles.some((role) => role !== "member"),
      ) ?? [];

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration"
        backLabel="Back to Administration"
        eyebrow="Access Management"
        eyebrowIcon={<UsersRound className="h-4 w-4" />}
        title="Staff Branch Access"
        description="Assign staff accounts to one or more church branches."
      />

      {staffUsers.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" />}
          title="No staff accounts found"
          description="Staff accounts will appear here once roles are assigned."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Branches</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {staffUsers.map((staffMember) => {
              const assignedBranchIds = new Set(
                (assignments ?? [])
                  .filter(
                    (assignment) =>
                      assignment.user_id === staffMember.id,
                  )
                  .map(
                    (assignment) =>
                      assignment.church_branch_id,
                  ),
              );

              const assignedBranches =
                (branches ?? []).filter((branch) =>
                  assignedBranchIds.has(branch.id),
                );

              const isSystemAdmin =
                staffMember.roles.includes("system_admin");

              return (
                <TableRow key={staffMember.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {staffMember.display_name ?? "Unnamed Staff"}
                    </p>
                  </TableCell>

                  <TableCell>
                    {staffMember.roles.join(", ")}
                  </TableCell>

                  <TableCell>
                    {isSystemAdmin
                      ? "All branches"
                      : assignedBranches.length > 0
                        ? assignedBranches
                            .map((branch) => branch.name)
                            .join(", ")
                        : "No branches assigned"}
                  </TableCell>

                  <TableCell>
                    {isSystemAdmin ? (
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        Automatic access
                      </span>
                    ) : (
                      <TableActionButton
                        href={`/portal/administration/staff-branch-access/${staffMember.id}`}
                      >
                        Manage
                      </TableActionButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  );
}

function StaffBranchAccessLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </PageContainer>
  );
}