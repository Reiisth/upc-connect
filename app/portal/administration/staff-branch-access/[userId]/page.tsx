import { Suspense } from "react";
import { notFound } from "next/navigation";

import BranchAccessForm from "./BranchAccessForm";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { roles } = await requirePortalTab(
    "administration",
  );

  if (!roles.includes("system_admin")) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-500">
          You do not have permission to manage staff branch
          access.
        </p>
      </div>
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

  const isSystemAdmin =
    roleNames.includes("system_admin");

  const initialBranchIds =
    assignments?.map(
      (assignment) => assignment.church_branch_id,
    ) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-prompt text-2xl font-semibold text-[#203264]">
          Manage Branch Access
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {profile.display_name ?? "Unnamed Staff"}
          {roleNames.length > 0 &&
            ` — ${roleNames.join(", ")}`}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {isSystemAdmin ? (
          <div className="rounded-xl bg-[#EEF3FB] p-4 text-sm text-[#203264]">
            System administrators automatically have access
            to all active branches.
          </div>
        ) : (
          <BranchAccessForm
            userId={userId}
            branches={branches ?? []}
            initialBranchIds={initialBranchIds}
          />
        )}
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}