"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateStaffBranchAccess } from "../actions";

type Branch = {
  id: string;
  name: string;
  code: string | null;
};

type BranchAccessFormProps = {
  userId: string;
  branches: Branch[];
  initialBranchIds: string[];
};

export default function BranchAccessForm({
  userId,
  branches,
  initialBranchIds,
}: BranchAccessFormProps) {
  const router = useRouter();

  const [selectedBranchIds, setSelectedBranchIds] =
    useState<string[]>(initialBranchIds);

  const [isPending, startTransition] = useTransition();

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((current) =>
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : [...current, branchId],
    );
  }

  function handleSave() {
    startTransition(async () => {
      await updateStaffBranchAccess(
        userId,
        selectedBranchIds,
      );

      router.push(
        "/portal/administration/staff-branch-access",
      );

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {branches.map((branch) => {
          const checked = selectedBranchIds.includes(
            branch.id,
          );

          return (
            <label
              key={branch.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#5D94E8]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleBranch(branch.id)}
                className="h-4 w-4 accent-[#203264]"
              />

              <div>
                <p className="font-medium text-slate-800">
                  {branch.name}
                </p>

                {branch.code && (
                  <p className="text-xs text-slate-500">
                    {branch.code}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 border-t pt-5">
        <Link
          href="/portal/administration/staff-branch-access"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-[#5D94E8] to-[#203264] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Branch Access"}
        </button>
      </div>
    </div>
  );
}