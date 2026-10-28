"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createCustomRole } from "./actions";
import { RolePermissionsSelector } from "./RolePermissionsSelector";
import type { PermissionRecord } from "./types";

type RoleCreateFormProps = {
  permissions: PermissionRecord[];
  canManagePermissions: boolean;
};

export default function RoleCreateForm({
  permissions,
  canManagePermissions,
}: RoleCreateFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePermissionToggle(
    permissionId: string,
    checked: boolean,
  ) {
    setSelectedPermissionIds((current) => {
      if (checked) {
        return current.includes(permissionId)
          ? current
          : [...current, permissionId];
      }

      return current.filter((id) => id !== permissionId);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("display_name", displayName.trim());
    formData.set("key", key.trim());
    formData.set("description", description.trim());
    formData.set("is_staff", String(isStaff));

    if (canManagePermissions) {
      selectedPermissionIds.forEach((permissionId) => {
        formData.append("permission_ids", permissionId);
      });
    }

    startTransition(async () => {
      try {
        const result = await createCustomRole(formData);

        if (!result.success || !result.roleId) {
          setError("The role could not be created.");
          return;
        }

        router.push(`/portal/administration/roles/${result.roleId}`);
        router.refresh();
      } catch (actionError) {
        setError(getErrorMessage(actionError));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection
        title="Role Information"
        description="Create a custom role with an immutable key and optional staff classification."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Display Name" htmlFor="role-display-name" required>
            <Input
              id="role-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Ministry Coordinator"
              disabled={isPending}
              required
            />
          </FormField>

          <FormField
            label="Role Key"
            htmlFor="role-key"
            required
            description="Lowercase letters, numbers, and underscores. Spaces and punctuation are normalized."
          >
            <Input
              id="role-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              maxLength={80}
              placeholder="e.g. ministry_coordinator"
              disabled={isPending}
              required
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="role-description"
            className="md:col-span-2"
            description="Optional description for administrators."
          >
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              placeholder="Describe what this role is responsible for."
              disabled={isPending}
            />
          </FormField>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
          <Checkbox
            checked={isStaff}
            onCheckedChange={(checked) => setIsStaff(checked === true)}
            disabled={isPending}
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">
              Staff role
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              Staff roles can be assigned to staff accounts through the existing Accounts workflow.
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection
        title="Initial Permissions"
        description={
          canManagePermissions
            ? "Select active permissions to assign when the role is created."
            : "Permission assignment requires roles.manage_permissions. You can create the role first and request permission management separately."
        }
      >
        {canManagePermissions ? (
          <RolePermissionsSelector
            permissions={permissions}
            selectedPermissionIds={selectedPermissionIds}
            disabled={isPending}
            onToggle={handlePermissionToggle}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No initial permissions will be assigned because your account does not have roles.manage_permissions.
          </div>
        )}
      </FormSection>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <FormActions>
        <Button variant="outline" asChild>
          <Link href="/portal/administration/roles">Cancel</Link>
        </Button>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating Role..." : "Create Role"}
        </Button>
      </FormActions>
    </form>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The role could not be created.";
}
