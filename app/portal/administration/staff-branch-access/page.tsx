import { Suspense } from "react";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default function StaffBranchAccessPage() {
  return (
    <Suspense fallback={<StaffBranchAccessLoading />}>
      <StaffBranchAccessContent />
    </Suspense>
  );
}

async function StaffBranchAccessContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-500">
          You do not have permission to manage staff branch access.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();

  const [
    { data: staff, error: staffError },
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
      `),

    admin
      .from("church_branches")
      .select(`
        id,
        name,
        code,
        is_active
      `)
      .eq("is_active", true)
      .order("name"),

    admin
      .from("user_branch_access")
      .select(`
        user_id,
        church_branch_id
      `),
  ]);

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (branchesError) {
    throw new Error(branchesError.message);
  }

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const staffUsers =
    staff
      ?.map((profile) => {
        const roleNames =
          profile.user_roles?.flatMap((item) => {
            const role = Array.isArray(item.role)
              ? item.role[0] ?? null
              : item.role ?? null;

            return role?.name ? [role.name] : [];
          }) ?? [];

        return {
          id: profile.id,
          display_name: profile.display_name,
          roles: roleNames,
        };
      })
      .filter((profile) =>
        profile.roles.some((role) => role !== "member"),
      ) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-prompt text-2xl font-semibold text-[#203264]">
          Staff Branch Access
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Assign staff accounts to one or more church branches.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">
                Assigned Branches
              </th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {staffUsers.map((staffMember) => {
              const assignedBranchIds = new Set(
                (assignments ?? [])
                  .filter(
                    (assignment) =>
                      assignment.user_id === staffMember.id,
                  )
                  .map(
                    (assignment) =>
                      assignment.church_branch_id,
                  ),
              );

              const assignedBranches =
                (branches ?? []).filter((branch) =>
                  assignedBranchIds.has(branch.id),
                );

              return (
                <tr key={staffMember.id}>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {staffMember.display_name ?? "Unnamed Staff"}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {staffMember.roles.join(", ")}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {staffMember.roles.includes("system_admin")
                      ? "All branches"
                      : assignedBranches.length > 0
                        ? assignedBranches
                          .map((branch) => branch.name)
                          .join(", ")
                        : "No branches assigned"}
                  </td>
                  <td className="px-4 py-4">
                    {staffMember.roles.includes("system_admin") ? (
                      <span className="text-sm text-slate-400">
                        All branches
                      </span>
                    ) : (
                      <Link
                        href={`/portal/administration/staff-branch-access/${staffMember.id}`}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Manage
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffBranchAccessLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}