import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { hasPermission } from "@/lib/permissions";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { requireAdministrationPermission } from "../../access";
import RoleCreateForm from "../RoleCreateForm";
import { getActivePermissions } from "../data";

export default function NewRolePage() {
  return (
    <Suspense fallback={<PageSkeleton kind="form" fields={5} metrics={0} columns={5} label="administration roles new" />}>
      <NewRoleContent />
    </Suspense>
  );
}

async function NewRoleContent() {
  const access = await requireAdministrationPermission("roles.create");
  const canManagePermissions = hasPermission(
    access.permissions,
    "roles.manage_permissions",
  );
  const permissions = canManagePermissions
    ? await getActivePermissions()
    : [];

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration/roles"
        backLabel="Back to Roles & Permissions"
        eyebrow="Administration"
        eyebrowIcon={<ShieldCheck className="h-4 w-4" />}
        title="Add Role"
        description="Create a custom role without changing any existing role assignments."
      />

      <RoleCreateForm
        permissions={permissions}
        canManagePermissions={canManagePermissions}
      />

    </PageContainer>
  );
}
