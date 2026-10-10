"use client";

import { Building2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FormActions } from "@/components/ui/form-actions";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  updateStaffBranchAccessFromAccount,
  updateStaffRoles,
} from "../actions";

export type StaffRoleOption = {
  id: string;
  key: string;
  displayName: string;
};

export type StaffAccessBranch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  isManageable: boolean;
};

type StaffAccessManagementProps = {
  userId: string;
  availableRoles: StaffRoleOption[];
  assignedRoles: StaffRoleOption[];
  assignedRoleIds: string[];
  branches: StaffAccessBranch[];
  assignedBranchIds: string[];
  isSystemAdmin: boolean;
  isArchived: boolean;
  canManageRoles: boolean;
  canManageBranchAccess: boolean;
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

export function StaffAccessManagement({
  userId,
  availableRoles,
  assignedRoles,
  assignedRoleIds,
  branches,
  assignedBranchIds,
  isSystemAdmin,
  isArchived,
  canManageRoles,
  canManageBranchAccess,
}: StaffAccessManagementProps) {
  const router = useRouter();
  const [selectedRoleIds, setSelectedRoleIds] = useState(
    () => [...assignedRoleIds],
  );
  const [selectedBranchIds, setSelectedBranchIds] = useState(
    () => [...assignedBranchIds],
  );
  const [roleFeedback, setRoleFeedback] = useState<Feedback>(null);
  const [branchFeedback, setBranchFeedback] = useState<Feedback>(null);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [isSavingBranches, setIsSavingBranches] = useState(false);

  const assignedRoleKey = [...assignedRoleIds].sort().join("|");
  const assignedBranchKey = [...assignedBranchIds].sort().join("|");

  useEffect(() => {
    setSelectedRoleIds([...assignedRoleIds]);
  }, [assignedRoleIds, assignedRoleKey]);

  useEffect(() => {
    setSelectedBranchIds([...assignedBranchIds]);
  }, [assignedBranchIds, assignedBranchKey]);

  const assignedBranchIdSet = new Set(assignedBranchIds);
  const assignedBranches = branches.filter((branch) =>
    assignedBranchIdSet.has(branch.id),
  );
  const rolesChanged = !hasSameIds(selectedRoleIds, assignedRoleIds);
  const branchesChanged = !hasSameIds(
    selectedBranchIds,
    assignedBranchIds,
  );

  async function handleRoleSave() {
    setRoleFeedback(null);
    setIsSavingRoles(true);

    try {
      await updateStaffRoles(userId, selectedRoleIds);
      setRoleFeedback({
        type: "success",
        message: "Role access updated successfully.",
      });

      if (selectedRoleIds.length === 0) {
        router.push("/portal/accounts/staff");
      } else {
        router.refresh();
      }
    } catch (error) {
      setRoleFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "Role access could not be updated.",
        ),
      });
    } finally {
      setIsSavingRoles(false);
    }
  }

  async function handleBranchSave() {
    setBranchFeedback(null);
    setIsSavingBranches(true);

    try {
      await updateStaffBranchAccessFromAccount(
        userId,
        selectedBranchIds,
      );
      setBranchFeedback({
        type: "success",
        message: "Branch access updated successfully.",
      });
      router.refresh();
    } catch (error) {
      setBranchFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "Branch access could not be updated.",
        ),
      });
    } finally {
      setIsSavingBranches(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5D94E8]" />

            <div>
              <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
                Role Access
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage the staff roles assigned to this account.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Current non-member roles
              </p>

              {assignedRoles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {assignedRoles.map((role) => (
                    <StatusBadge key={role.id} variant="info">
                      {role.displayName}
                    </StatusBadge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No non-member roles are assigned.
                </p>
              )}
            </div>

            {isArchived ? (
              <ArchivedAccessNotice description="Role editing is disabled while this account is archived. Restore the account before changing its roles." />
            ) : !canManageRoles ? (
              <ReadOnlyAccessNotice description="Role editing is unavailable because you do not have the required account permission." />
            ) : availableRoles.length > 0 ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRoleSave();
                }}
                className="space-y-5"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Staff roles available to manage
                  </p>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {availableRoles.map((role) => {
                      const isSelected = selectedRoleIds.includes(
                        role.id,
                      );

                      return (
                        <label
                          key={role.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-[#5D94E8] dark:border-slate-700 dark:hover:border-[#8DB5F0]"
                        >
                          <span className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedRoleIds((current) =>
                                  checked === true
                                    ? addId(current, role.id)
                                    : removeId(current, role.id),
                                );
                                setRoleFeedback(null);
                              }}
                              aria-label={`Assign ${role.displayName} role`}
                            />

                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {role.displayName}
                            </span>
                          </span>

                          <StatusBadge
                            variant={isSelected ? "success" : "muted"}
                          >
                            {isSelected ? "Selected" : "Available"}
                          </StatusBadge>
                        </label>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Other non-member role assignments are preserved and are not editable here.
                  </p>
                </div>

                {roleFeedback && (
                  <FeedbackMessage feedback={roleFeedback} />
                )}

                <FormActions>
                  <Button
                    type="submit"
                    disabled={!rolesChanged || isSavingRoles}
                  >
                    {isSavingRoles ? "Saving roles..." : "Save Role Access"}
                  </Button>
                </FormActions>
              </form>
            ) : (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No manageable staff roles found"
                description="The roles table does not currently contain any recognized staff roles."
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5D94E8]" />

            <div>
              <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
                Branch Access
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage the church branches this account can access.
              </p>
            </div>
          </div>

          {isSystemAdmin ? (
            <div className="flex items-start gap-3 rounded-2xl bg-[#EEF3FB] p-4 dark:bg-slate-800">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#203264] dark:text-slate-200" />

              <div>
                <StatusBadge variant="info">
                  All active branches
                </StatusBadge>

                <p className="mt-2 text-sm text-[#203264] dark:text-slate-200">
                  System administrators automatically have access to every active church branch. Manual branch controls are unavailable for this account.
                </p>
              </div>
            </div>
          ) : branches.length > 0 ? (
            isArchived ? (
              <ReadOnlyBranchAccess
                branches={branches}
                assignedBranchIds={assignedBranchIds}
                description="Branch editing is disabled while this account is archived. Existing branch assignments are preserved."
              />
            ) : !canManageBranchAccess ? (
              <ReadOnlyBranchAccess
                branches={branches}
                assignedBranchIds={assignedBranchIds}
                description="Branch editing is unavailable because you do not have the required account permission."
              />
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleBranchSave();
                }}
                className="space-y-5"
              >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Current assignments
                </p>

                {assignedBranches.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignedBranches.map((branch) => (
                      <StatusBadge
                        key={branch.id}
                        variant={branch.isActive ? "success" : "muted"}
                      >
                        {branch.name}
                        {branch.isActive ? " · Active" : " · Inactive"}
                      </StatusBadge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    No explicit branch assignments are currently set.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Branches available to manage
                </p>

                <div className="mt-2 space-y-3">
                  {branches.map((branch) => {
                    const isSelected = selectedBranchIds.includes(
                      branch.id,
                    );
                    const isExistingAssignment = assignedBranchIdSet.has(
                      branch.id,
                    );
                    const isDisabled =
                      !branch.isManageable ||
                      !branch.isActive && !isExistingAssignment;

                    return (
                      <label
                        key={branch.id}
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition dark:border-slate-700 ${
                          isDisabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:bg-slate-900"
                            : "cursor-pointer border-slate-200 hover:border-[#5D94E8] dark:hover:border-[#8DB5F0]"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              setSelectedBranchIds((current) =>
                                checked === true
                                  ? addId(current, branch.id)
                                  : removeId(current, branch.id),
                              );
                              setBranchFeedback(null);
                            }}
                            aria-label={`Assign ${branch.name} branch`}
                          />

                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {branch.name}
                            </span>

                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                              {branch.code
                                ? `Code: ${branch.code}`
                                : "No branch code"}
                              {!branch.isManageable
                                ? " · Outside your branch scope"
                                : ""}
                            </span>
                          </span>
                        </span>

                        <StatusBadge
                          variant={branch.isActive ? "success" : "muted"}
                        >
                          {branch.isActive ? "Active" : "Inactive"}
                        </StatusBadge>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Active branches in your branch scope can be added or removed. Existing assignments outside your scope remain preserved and cannot be changed here. Inactive branches remain visible while assigned and cannot be newly assigned.
                </p>
              </div>

              {branchFeedback && (
                <FeedbackMessage feedback={branchFeedback} />
              )}

              <FormActions>
                <Button
                  type="submit"
                  disabled={!branchesChanged || isSavingBranches}
                >
                  {isSavingBranches
                    ? "Saving branches..."
                    : "Save Branch Access"}
                </Button>
              </FormActions>
              </form>
            )
          ) : (
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No church branches found"
              description="Create an active church branch before assigning branch access to this staff account."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ArchivedAccessNotice({ description }: { description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
      <StatusBadge variant="muted">Archived</StatusBadge>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}

function ReadOnlyAccessNotice({ description }: { description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
      <StatusBadge variant="muted">Read-only</StatusBadge>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}

function ReadOnlyBranchAccess({
  branches,
  assignedBranchIds,
  description,
}: {
  branches: StaffAccessBranch[];
  assignedBranchIds: string[];
  description: string;
}) {
  const assignedBranchIdSet = new Set(assignedBranchIds);

  return (
    <div className="space-y-5">
      <ReadOnlyAccessNotice description={description} />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Branch access
        </p>

        <div className="mt-2 space-y-3">
          {branches.map((branch) => {
            const isAssigned = assignedBranchIdSet.has(branch.id);

            return (
              <div
                key={branch.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {branch.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {branch.code
                      ? `Code: ${branch.code}`
                      : "No branch code"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <StatusBadge
                    variant={isAssigned ? "info" : "muted"}
                  >
                    {isAssigned ? "Assigned" : "Not assigned"}
                  </StatusBadge>

                  <StatusBadge
                    variant={branch.isActive ? "success" : "muted"}
                  >
                    {branch.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;

  return (
    <p
      role={feedback.type === "error" ? "alert" : "status"}
      className={
        feedback.type === "error"
          ? "rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300"
      }
    >
      {feedback.message}
    </p>
  );
}

function hasSameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;

  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

function addId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removeId(ids: string[], id: string) {
  return ids.filter((currentId) => currentId !== id);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}
