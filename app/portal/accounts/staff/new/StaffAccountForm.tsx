"use client";

import Link from "next/link";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

import { createStaffAccount } from "../actions";

export type StaffAccountRoleOption = {
  id: string;
  key: string;
  displayName: string;
};

export type StaffAccountBranchOption = {
  id: string;
  name: string;
  code: string | null;
};

type StaffAccountFormProps = {
  roles: StaffAccountRoleOption[];
  branches: StaffAccountBranchOption[];
};

export default function StaffAccountForm({
  roles,
  branches,
}: StaffAccountFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRoles = roles.filter((role) =>
    selectedRoleIds.includes(role.id),
  );
  const hasSystemAdmin = selectedRoles.some(
    (role) => role.key === "system_admin",
  );

  function toggleId(
    currentIds: string[],
    id: string,
    checked: boolean,
  ) {
    if (checked) {
      return currentIds.includes(id)
        ? currentIds
        : [...currentIds, id];
    }

    return currentIds.filter((currentId) => currentId !== id);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedDisplayName = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (selectedRoleIds.length === 0) {
      setError("Select at least one staff role.");
      return;
    }

    if (!hasSystemAdmin && selectedBranchIds.length === 0) {
      setError(
        "Select at least one active branch for non-system-admin staff.",
      );
      return;
    }

    const formData = new FormData();
    formData.set("display_name", trimmedDisplayName);
    formData.set("email", normalizedEmail);

    selectedRoleIds.forEach((roleId) => {
      formData.append("role_ids", roleId);
    });

    if (!hasSystemAdmin) {
      selectedBranchIds.forEach((branchId) => {
        formData.append("branch_ids", branchId);
      });
    }

    startTransition(async () => {
      const result = await createStaffAccount(formData);

      if (!result.success || !result.userId) {
        setError(
          result.error ??
            "The staff account could not be provisioned.",
        );
        return;
      }

      // Clear the client-owned form state before navigation so a cached
      // client segment cannot restore the previous invitation on revisit.
      setDisplayName("");
      setEmail("");
      setSelectedRoleIds([]);
      setSelectedBranchIds([]);
      setError(null);

      router.push(`/portal/accounts/staff/${result.userId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection
        title="Account Information"
        description="Use the staff user's own email address. They will create their password from the invitation."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Display Name"
            htmlFor="display-name"
            required
            description="This identifies the account in staff management."
          >
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="e.g. Maria Santos"
                autoComplete="name"
                className="pl-9"
                maxLength={200}
                disabled={isPending}
                required
              />
            </div>
          </FormField>

          <FormField
            label="Email"
            htmlFor="staff-email"
            required
            description="Existing accounts are promoted without creating a duplicate."
          >
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                autoComplete="email"
                className="pl-9"
                disabled={isPending}
                required
              />
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Staff Roles"
        description="Select one or more non-member staff roles. Existing roles are preserved when an account is promoted."
      >
        <FormField
          label="Roles"
          required
          description="The member role is not available in this form."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => {
              const selected = selectedRoleIds.includes(role.id);

              return (
                <label
                  key={role.id}
                  htmlFor={`role-${role.id}`}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-[#5D94E8] dark:border-slate-700 dark:hover:border-[#8DB5F0]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selected}
                      disabled={isPending}
                      onCheckedChange={(checked) => {
                        setSelectedRoleIds((currentIds) =>
                          toggleId(currentIds, role.id, checked === true),
                        );
                        setError(null);
                      }}
                    />

                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {role.displayName}
                    </span>
                  </span>

                  <StatusBadge variant={selected ? "success" : "muted"}>
                    {selected ? "Selected" : "Available"}
                  </StatusBadge>
                </label>
              );
            })}
          </div>
        </FormField>

        {hasSystemAdmin && (
          <div className="flex items-start gap-3 rounded-2xl bg-[#EEF3FB] p-4 dark:bg-slate-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#203264] dark:text-slate-200" />
            <div>
              <StatusBadge variant="info">
                System administrator selected
              </StatusBadge>
              <p className="mt-2 text-sm text-[#203264] dark:text-slate-200">
                This account will automatically have access to all active church branches. Explicit branch assignments are not required.
              </p>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Branch Access"
        description="Assign active branches for staff who do not have system administrator access."
      >
        {hasSystemAdmin ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <Building2 className="h-5 w-5 shrink-0 text-[#5D94E8]" />
            <div>
              <StatusBadge variant="info">All active branches</StatusBadge>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Existing explicit branch rows are preserved, but system administrator access is evaluated across every active branch.
              </p>
            </div>
          </div>
        ) : branches.length > 0 ? (
          <FormField
            label="Active Branches"
            required
            description="Select at least one branch. Existing branch assignments are preserved when an account is promoted."
          >
            <div className="space-y-3">
              {branches.map((branch) => {
                const selected = selectedBranchIds.includes(branch.id);

                return (
                  <label
                    key={branch.id}
                    htmlFor={`branch-${branch.id}`}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-[#5D94E8] dark:border-slate-700 dark:hover:border-[#8DB5F0]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        id={`branch-${branch.id}`}
                        checked={selected}
                        disabled={isPending}
                        onCheckedChange={(checked) => {
                          setSelectedBranchIds((currentIds) =>
                            toggleId(
                              currentIds,
                              branch.id,
                              checked === true,
                            ),
                          );
                          setError(null);
                        }}
                      />

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {branch.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          {branch.code
                            ? `Code: ${branch.code}`
                            : "No branch code"}
                        </span>
                      </span>
                    </span>

                    <StatusBadge variant={selected ? "success" : "muted"}>
                      {selected ? "Selected" : "Available"}
                    </StatusBadge>
                  </label>
                );
              })}
            </div>
          </FormField>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <StatusBadge variant="warning">
              No active branches available
            </StatusBadge>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Create an active branch before assigning a non-system-admin staff account.
            </p>
          </div>
        )}
      </FormSection>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <FormActions>
        <Button variant="outline" asChild>
          <Link href="/portal/accounts/staff">Cancel</Link>
        </Button>

        <Button
          type="submit"
          disabled={
            isPending ||
            roles.length === 0 ||
            (!hasSystemAdmin && selectedBranchIds.length === 0)
          }
        >
          {isPending
            ? "Provisioning account..."
            : "Create Staff Account"}
        </Button>
      </FormActions>
    </form>
  );
}
