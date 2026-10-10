import { Suspense } from "react";
import { ShieldPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAccessibleActiveAccountBranches,
  requireAccountsPermission,
} from "../../access";

import StaffAccountForm, {
  type StaffAccountBranchOption,
  type StaffAccountRoleOption,
} from "./StaffAccountForm";

type RoleRow = {
  id: string;
  key: string;
  display_name: string | null;
  is_staff: boolean;
  is_active: boolean;
};

export default function NewStaffAccountPage() {
  return (
    <Suspense fallback={<NewStaffAccountLoading />}>
      <NewStaffAccountContent />
    </Suspense>
  );
}

async function NewStaffAccountContent() {
  const access = await requireAccountsPermission("accounts.invite");

  const admin = createAdminClient();

  const [
    { data: roleRows, error: rolesError },
  ] = await Promise.all([
    admin
      .from("roles")
      .select(
        "id, key, display_name, is_staff, is_active",
      )
      .eq("is_staff", true)
      .eq("is_active", true)
      .order("display_name"),
  ]);

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const roles: StaffAccountRoleOption[] = (
    (roleRows ?? []) as RoleRow[]
  )
    .filter((role) => role.is_staff && role.is_active)
    .map((role) => ({
      id: role.id,
      key: role.key,
      displayName: role.display_name?.trim() || formatRole(role.key),
    }));

  const branchOptions = await getAccessibleActiveAccountBranches(
    access,
    admin,
  );
  const branches: StaffAccountBranchOption[] = branchOptions.map((branch) => ({
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

function formatRole(role: string) {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
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
