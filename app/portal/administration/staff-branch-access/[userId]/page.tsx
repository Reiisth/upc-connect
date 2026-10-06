import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UsersRound } from "lucide-react";

import BranchAccessForm from "./BranchAccessForm";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

import { EmptyState } from "@/components/ui/empty-state";
import { FormSection } from "@/components/ui/form-section";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default function ManageStaffBranchAccessPage(
  props: PageProps,
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ManageStaffBranchAccessContent {...props} />
    </Suspense>
  );
}

async function ManageStaffBranchAccessContent({
  params,
}: PageProps) {
  const { userId } = await params;

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
    { data: profile, error: profileError },
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
      `)
      .eq("id", userId)
      .single(),

    admin
      .from("church_branches")
      .select(`
        id,
        name,
        code
      `)
      .eq("is_active", true)
      .order("name"),

    admin
      .from("user_branch_access")
      .select("church_branch_id")
      .eq("user_id", userId),
  ]);

  if (profileError || !profile) {
    notFound();
  }

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const roleNames =
    profile.user_roles?.flatMap((item) => {
      const role = Array.isArray(item.role)
        ? item.role[0] ?? null
        : item.role ?? null;

      return role?.name ? [role.name] : [];
    }) ?? [];

  const isSystemAdmin = roleNames.includes("system_admin");

  const initialBranchIds =
    assignments?.map(
      (assignment) => assignment.church_branch_id,
    ) ?? [];

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/administration/staff-branch-access"
        backLabel="Back to Staff Branch Access"
        eyebrow="Access Management"
        eyebrowIcon={<UsersRound className="h-4 w-4" />}
        title="Manage Branch Access"
        description={
          profile.display_name
            ? `Manage branch assignments for ${profile.display_name}.`
            : "Manage branch assignments for this staff account."
        }
      />

      <FormSection
        title="Branch Assignments"
        description={
          roleNames.length > 0
            ? `Roles: ${roleNames.join(", ")}`
            : undefined
        }
      >
        {isSystemAdmin ? (
          <div className="rounded-xl bg-[#EEF3FB] p-4 text-sm text-[#203264] dark:bg-slate-800 dark:text-slate-200">
            System administrators automatically have access to all active branches.
          </div>
        ) : (
          <BranchAccessForm
            userId={userId}
            branches={branches ?? []}
            initialBranchIds={initialBranchIds}
          />
        )}
      </FormSection>
    </PageContainer>
  );
}

function PageLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-72 rounded-2xl" />
    </PageContainer>
  );
}