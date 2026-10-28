import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { hasPermission } from "@/lib/permissions";

import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { requireAdministrationPermission } from "../../access";
import RoleCreateForm from "../RoleCreateForm";
import { getActivePermissions } from "../data";

export default function NewRolePage() {
  return (
    <Suspense fallback={<NewRoleLoading />}>
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
        eyebrow="Roles & Permissions"
        eyebrowIcon={<ShieldCheck className="h-4 w-4" />}
        title="Create Custom Role"
        description="Create a custom role without changing any existing role assignments."
      />

      <RoleCreateForm
        permissions={permissions}
        canManagePermissions={canManagePermissions}
      />

      <p className="text-sm text-slate-500">
        <Link
          href="/portal/administration/roles"
          className="font-medium text-[#203264] underline-offset-4 hover:underline"
        >
          Return to the roles list
        </Link>
        .
      </p>
    </PageContainer>
  );
}

function NewRoleLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>

      <Skeleton className="h-[720px] rounded-2xl" />
    </PageContainer>
  );
}
