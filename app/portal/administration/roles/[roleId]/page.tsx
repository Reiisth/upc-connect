import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { hasPermission } from "@/lib/permissions";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { requireAdministrationPermission } from "../../access";
import RoleDetailEditor from "../RoleDetailEditor";
import { getRoleDetail } from "../data";

type RoleDetailPageProps = {
  params: Promise<{
    roleId: string;
  }>;
};

export default function RoleDetailPage(props: RoleDetailPageProps) {
  return (
    <Suspense fallback={<PageSkeleton kind="detail" fields={4} metrics={0} columns={5} label="administration roles" />}>
      <RoleDetailContent {...props} />
    </Suspense>
  );
}

async function RoleDetailContent({
  params,
}: RoleDetailPageProps) {
  const { roleId } = await params;
  const access = await requireAdministrationPermission("roles.view");
  const detail = await getRoleDetail(roleId);

  if (!detail) {
    notFound();
  }

  const canUpdate = hasPermission(access.permissions, "roles.update");
  const canManagePermissions = hasPermission(
    access.permissions,
    "roles.manage_permissions",
  );
  const canDeactivate = hasPermission(
    access.permissions,
    "roles.deactivate",
  );
  const canDelete = hasPermission(access.permissions, "roles.delete");
  const roleTitle = detail.role.display_name ?? detail.role.key;

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration/roles"
        backLabel="Back to Roles & Permissions"
        eyebrow="Roles & Permissions"
        eyebrowIcon={<ShieldCheck className="h-4 w-4" />}
        title={roleTitle}
        description="Review role metadata and permission access. Account-role assignments are managed separately."
      />

      <RoleDetailEditor
        role={detail.role}
        permissions={detail.permissions}
        currentPermissionIds={detail.currentPermissionIds}
        canUpdate={canUpdate}
        canManagePermissions={canManagePermissions}
        canDeactivate={canDeactivate}
        canDelete={canDelete}
      />
    </PageContainer>
  );
}
