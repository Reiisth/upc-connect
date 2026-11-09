import { PageSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Suspense } from "react";
import {
  Building2,
  Pencil,
  Plus,
} from "lucide-react";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrationPermission } from "../access";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
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
import { BranchLifecycleAction } from "./BranchLifecycleAction";

export default function BranchesPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="table" fields={6} metrics={0} columns={5} label="administration branches" />}>
      <BranchesContent />
    </Suspense>
  );
}

async function BranchesContent() {
  const { permissions } = await requireAdministrationPermission(
    "branches.view",
  );
  const canManageBranches = hasPermission(
    permissions,
    "branches.manage",
  );

  const admin = createAdminClient();

  const { data: branches, error } = await admin
    .from("church_branches")
    .select(`
      id,
      name,
      code,
      street_address,
      barangay,
      city,
      province,
      country,
      is_active,
      created_at
    `)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration"
        backLabel="Back to Administration"
        eyebrow="Administration"
        eyebrowIcon={<Building2 className="h-4 w-4" />}
        title="Church Branches"
        description="Create, edit, and manage the church branches available in UPC Connect."
        action={canManageBranches ? (
          <Button asChild>
            <Link href="/portal/administration/branches/new">
              <Plus />
              Add Branch
            </Link>
          </Button>
        ) : undefined}
      />

      {!branches || branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No church branches yet"
          description="Create your first church branch to start organizing members and staff by location."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {branches.map((branch) => {
              const location = [
                branch.barangay,
                branch.city,
                branch.province,
                branch.country,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <TableRow key={branch.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {branch.name}
                      </p>

                      {branch.street_address && (
                        <p className="mt-1 text-xs text-slate-500">
                          {branch.street_address}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {branch.code ?? "—"}
                  </TableCell>

                  <TableCell>
                    {location || "—"}
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      variant={
                        branch.is_active
                          ? "success"
                          : "muted"
                      }
                    >
                      {branch.is_active
                        ? "Active"
                        : "Inactive"}
                    </StatusBadge>
                  </TableCell>

                  <TableCell>
                    {canManageBranches ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <TableActionButton
                          href={`/portal/administration/branches/${branch.id}/edit`}
                          icon={<Pencil />}
                        >
                          Edit
                        </TableActionButton>

                        <BranchLifecycleAction
                          branchId={branch.id}
                          branchName={branch.name}
                          isActive={branch.is_active}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">
                        View only
                      </span>
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
