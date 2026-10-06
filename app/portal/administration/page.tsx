import { Suspense } from "react";
import Link from "next/link";
import { Building2, UsersRound } from "lucide-react";
import { requirePortalTab } from "@/lib/require-portal-tab";

export default function AdministrationPage() {
  return (
    <Suspense fallback={<AdministrationLoading />}>
      <AdministrationContent />
    </Suspense>
  );
}

async function AdministrationContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-500">
          You do not have permission to access administration settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-prompt text-2xl font-semibold text-[#203264]">
          Administration
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage system-wide settings and church configuration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/portal/administration/branches"
          className="group block rounded-2xl border bg-white p-5 transition hover:border-[#5D94E8] hover:shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-prompt font-semibold text-[#203264]">
                Church Branches
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create, edit, and manage church branches.
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/portal/administration/staff-branch-access"
          className="group block rounded-2xl border bg-white p-5 transition hover:border-[#5D94E8] hover:shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]">
              <UsersRound className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-prompt font-semibold text-[#203264]">
                Staff Branch Access
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assign staff accounts to church branches.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function AdministrationLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}