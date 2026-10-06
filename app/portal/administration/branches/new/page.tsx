import Link from "next/link";
import { Suspense } from "react";

import { createBranch } from "../actions";
import { requirePortalTab } from "@/lib/require-portal-tab";

export default function NewBranchPage() {
  return (
    <Suspense fallback={<NewBranchLoading />}>
      <NewBranchContent />
    </Suspense>
  );
}

async function NewBranchContent() {
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-500">
          You do not have permission to create church branches.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-prompt text-2xl font-semibold text-[#203264]">
          Create Church Branch
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Add a new church branch to UPC Connect.
        </p>
      </div>

      <form
        action={createBranch}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Branch Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. UPC Batangas Main"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Branch Code
            </label>

            <input
              id="code"
              name="code"
              type="text"
              required
              placeholder="e.g. MAIN"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div>
            <label
              htmlFor="country"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Country
            </label>

            <input
              id="country"
              name="country"
              type="text"
              defaultValue="Philippines"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="street_address"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Street Address
            </label>

            <input
              id="street_address"
              name="street_address"
              type="text"
              placeholder="Street / Sitio / Purok"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div>
            <label
              htmlFor="barangay"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Barangay
            </label>

            <input
              id="barangay"
              name="barangay"
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div>
            <label
              htmlFor="city"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              City / Municipality
            </label>

            <input
              id="city"
              name="city"
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>

          <div>
            <label
              htmlFor="province"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Province
            </label>

            <input
              id="province"
              name="province"
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#5D94E8]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-5">
          <Link
            href="/portal/administration/branches"
            className="rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-[#5D94E8] to-[#203264] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Create Branch
          </button>
        </div>
      </form>
    </div>
  );
}

function NewBranchLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}