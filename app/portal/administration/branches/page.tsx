import { Suspense } from "react";
import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { setBranchActive } from "./actions";

export default function BranchesPage() {
  return (
    <Suspense fallback={<BranchesLoading />}>
      <BranchesContent />
    </Suspense>
  );
}

async function BranchesContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-500">
          You do not have permission to manage church branches.
        </p>
      </div>
    );
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-prompt text-2xl font-semibold text-[#203264]">
            Church Branches
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage the church branches available in UPC Connect.
          </p>
        </div>

        <Link
          href="/portal/administration/branches/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5D94E8] to-[#203264] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {(branches ?? []).map((branch) => {
              const location = [
                branch.barangay,
                branch.city,
                branch.province,
                branch.country,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <tr key={branch.id}>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {branch.name}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {branch.code ?? "—"}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {location || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={
                        branch.is_active
                          ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
                      }
                    >
                      {branch.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/portal/administration/branches/${branch.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>

                      <form
                        action={setBranchActive.bind(
                          null,
                          branch.id,
                          !branch.is_active,
                        )}
                      >
                        <button
                          type="submit"
                          className={
                            branch.is_active
                              ? "rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                              : "rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                          }
                        >
                          {branch.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
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

function BranchesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}