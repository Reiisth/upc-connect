import { Suspense } from "react";
import { ShieldPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/staff-roles";
import { requirePortalTab } from "@/lib/require-portal-tab";

import StaffAccountForm, {
  type StaffAccountBranchOption,
  type StaffAccountRoleOption,
} from "./StaffAccountForm";

type RoleRow = {
  id: string;
  name: string;
};

type BranchRow = {
  id: string;
  name: string;
  code: string | null;
};

export default function NewStaffAccountPage() {
  return (
    <Suspense fallback={<NewStaffAccountLoading />}>
      <NewStaffAccountContent />
    </Suspense>
  );
}

async function NewStaffAccountContent() {
  await requirePortalTab("accounts");

  const admin = createAdminClient();

  const [
    { data: roleRows, error: rolesError },
    { data: branchRows, error: branchesError },
  ] = await Promise.all([
    admin
      .from("roles")
      .select("id, name")
      .order("name"),
    admin
      .from("church_branches")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  const roles: StaffAccountRoleOption[] = (
    (roleRows ?? []) as RoleRow[]
  )
    .filter((role) => isStaffRole(role.name))
    .map((role) => ({
      id: role.id,
      name: role.name,
    }));

  const branches: StaffAccountBranchOption[] = (
    (branchRows ?? []) as BranchRow[]
  ).map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
  }));

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/accounts/staff"
        backLabel="Back to Staff Accounts"
        eyebrow="Staff Accounts"
        eyebrowIcon={<ShieldPlus className="h-4 w-4" />}
        title="New Staff Account"
        description="Invite a new staff user or grant staff access to an existing account."
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={<ShieldPlus className="h-5 w-5" />}
          title="No staff roles available"
          description="Add a recognized staff role before creating a staff account."
        />
      ) : (
        <StaffAccountForm roles={roles} branches={branches} />
      )}
    </PageContainer>
  );
}

function NewStaffAccountLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-[520px] rounded-2xl" />
    </PageContainer>
  );
}
