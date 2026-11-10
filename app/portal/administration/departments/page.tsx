import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import { Network, Pencil, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import { requireActiveAccount } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DepartmentLifecycleAction } from "./DepartmentLifecycleAction";

export default function DepartmentsPage() {
  return <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="administration departments" />}><DepartmentsContent /></Suspense>;
}

async function DepartmentsContent() {
  "use cache: private";
  cacheLife({ stale: 300 });
  cacheTag("portal:administration-departments");
  const { user } = await requireActiveAccount();
  const permissions = await getCurrentUserPermissions(user.id);
  if (!hasAnyPermission(permissions, ["departments.view", "departments.manage"])) redirect("/access-denied");
  const canManage = hasPermission(permissions, "departments.manage");
  const { data: departments, error } = await createAdminClient()
    .from("departments")
    .select("id, name, is_active")
    .order("name");
  if (error) throw new Error("Unable to load church departments.");

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration"
        backLabel="Back to Administration"
        eyebrow="Administration"
        eyebrowIcon={<Network className="h-4 w-4" />}
        title="Church Departments"
        description="Manage the global department options used in Member church information."
        action={canManage ? <Button asChild><Link href="/portal/administration/departments/new"><Plus />Add Department</Link></Button> : undefined}
      />
      {!departments?.length ? (
        <EmptyState icon={<Network className="h-5 w-5" />} title="No departments yet" description={canManage ? "Add a department to make it available for Member assignments." : "There are no church departments to display."} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium text-slate-900">{department.name}</TableCell>
                <TableCell><StatusBadge variant={department.is_active ? "success" : "muted"}>{department.is_active ? "Active" : "Inactive"}</StatusBadge></TableCell>
                <TableCell>
                  {canManage ? <div className="flex flex-wrap items-center gap-3">
                    <TableActionButton href={`/portal/administration/departments/${department.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>
                    <DepartmentLifecycleAction departmentId={department.id} name={department.name} isActive={department.is_active} />
                  </div> : <span className="text-sm text-slate-500">View only</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  );
}
