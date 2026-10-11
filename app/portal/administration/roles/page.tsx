import Link from "next/link";
import { Suspense } from "react";
import { Plus, ShieldCheck } from "lucide-react";

import { hasAnyPermission, hasPermission } from "@/lib/permissions";

import { Button } from "@/components/ui/button";
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
import { TableActionButton } from "@/components/ui/table-action-button";

import { requireAdministrationPermission } from "../access";
import { getRolesOverview } from "./data";

export default function RolesPage() {
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent />
    </Suspense>
  );
}

async function RolesContent() {
  const access = await requireAdministrationPermission("roles.view");
  const roles = await getRolesOverview();
  const canCreate = hasPermission(access.permissions, "roles.create");
  const canEdit = hasAnyPermission(access.permissions, [
    "roles.update",
    "roles.manage_permissions",
  ]);

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration"
        backLabel="Back to Administration"
        eyebrow="Administration"
        eyebrowIcon={<ShieldCheck className="h-4 w-4" />}
        title="Roles & Permissions"
        description="Review role metadata and manage permission mappings without changing account assignments."
        action={canCreate ? (
          <Button asChild>
            <Link href="/portal/administration/roles/new">
              <Plus />
              Create Role
            </Link>
          </Button>
        ) : undefined}
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="No roles found"
          description="There are no role metadata records available to display."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Assigned Users</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="min-w-[180px]">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {role.display_name ?? role.name ?? role.key}
                    </p>
                    {role.description && (
                      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                        {role.description}
                      </p>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {role.key}
                  </code>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge variant={role.is_system ? "info" : "default"}>
                      {role.is_system ? "System" : "Custom"}
                    </StatusBadge>
                    <StatusBadge variant={role.is_staff ? "success" : "muted"}>
                      {role.is_staff ? "Staff" : "Non-staff"}
                    </StatusBadge>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge variant={role.is_active ? "success" : "muted"}>
                    {role.is_active ? "Active" : "Inactive"}
                  </StatusBadge>
                </TableCell>

                <TableCell>{role.assigned_permission_count}</TableCell>
                <TableCell>{role.assigned_user_count}</TableCell>

                <TableCell>
                  {canEdit ? (
                    <TableActionButton href={`/portal/administration/roles/${role.id}`}>
                      Edit
                    </TableActionButton>
                  ) : (
                    <TableActionButton href={`/portal/administration/roles/${role.id}`}>
                      View
                    </TableActionButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  );
}

function RolesLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </PageContainer>
  );
}
