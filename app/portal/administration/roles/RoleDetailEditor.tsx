"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

import {
  updateRoleMetadata,
  updateRolePermissions,
} from "./actions";
import { RoleLifecycleActions } from "./RoleLifecycleActions";
import { RolePermissionsSelector } from "./RolePermissionsSelector";
import type {
  PermissionRecord,
  RoleRecord,
} from "./types";

type RoleDetailEditorProps = {
  role: RoleRecord;
  permissions: PermissionRecord[];
  currentPermissionIds: string[];
  canUpdate: boolean;
  canManagePermissions: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

const MEMBER_PROTECTED_PERMISSION_KEYS = new Set([
  "profile.view",
  "profile.update",
]);

export default function RoleDetailEditor({
  role,
  permissions,
  currentPermissionIds,
  canUpdate,
  canManagePermissions,
  canDeactivate,
  canDelete,
}: RoleDetailEditorProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    role.display_name ?? role.key,
  );
  const [description, setDescription] = useState(
    role.description ?? "",
  );
  const [isStaff, setIsStaff] = useState(role.is_staff);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(
    () => [...currentPermissionIds],
  );
  const [metadataFeedback, setMetadataFeedback] = useState<Feedback>(null);
  const [permissionFeedback, setPermissionFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();

  const currentPermissionKey = [...currentPermissionIds].sort().join("|");

  useEffect(() => {
    setSelectedPermissionIds([...currentPermissionIds]);
  }, [currentPermissionKey, currentPermissionIds]);

  useEffect(() => {
    setDisplayName(role.display_name ?? role.key);
    setDescription(role.description ?? "");
    setIsStaff(role.is_staff);
  }, [role.display_name, role.description, role.is_staff, role.key]);

  const protectedPermissionIds = role.key === "system_admin"
    ? currentPermissionIds
    : role.key === "member"
      ? permissions
        .filter((permission) =>
          MEMBER_PROTECTED_PERMISSION_KEYS.has(permission.key),
        )
        .filter((permission) => currentPermissionIds.includes(permission.id))
        .map((permission) => permission.id)
      : [];
  const hasLifecycleControls =
    (canDeactivate && !["system_admin", "member"].includes(role.key)) ||
    (canDelete &&
      !role.is_system &&
      ![
        "system_admin",
        "member",
        "pastor",
        "accounting_officer",
        "evangelism_officer",
        "spiritual_ministry_officer",
        "usher",
      ].includes(role.key));

  function togglePermission(
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

  function handleMetadataSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMetadataFeedback(null);

    startTransition(async () => {
      try {
        await updateRoleMetadata(role.id, {
          displayName,
          description,
          isStaff,
        });
        setMetadataFeedback({
          type: "success",
          message: "Role details updated successfully.",
        });
        router.refresh();
      } catch (error) {
        setMetadataFeedback({
          type: "error",
          message: getErrorMessage(error, "Role details could not be updated."),
        });
      }
    });
  }

  function handlePermissionSave() {
    setPermissionFeedback(null);

    startTransition(async () => {
      try {
        await updateRolePermissions(role.id, selectedPermissionIds);
        setPermissionFeedback({
          type: "success",
          message: "Role permissions updated successfully.",
        });
        router.refresh();
      } catch (error) {
        setPermissionFeedback({
          type: "error",
          message: getErrorMessage(
            error,
            "Role permissions could not be updated.",
          ),
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role Information</CardTitle>
          <CardDescription>
            Role keys and system classification are protected after creation.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleMetadataSave} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Display Name" htmlFor="role-display-name" required>
                <Input
                  id="role-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={120}
                  disabled={!canUpdate || isPending}
                  required
                />
              </FormField>

              <FormField
                label="Role Key"
                htmlFor="role-key"
                description="Immutable after creation."
              >
                <Input
                  id="role-key"
                  value={role.key}
                  readOnly
                  disabled
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="role-description"
                className="md:col-span-2"
              >
                <Textarea
                  id="role-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  disabled={!canUpdate || isPending}
                />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge variant={role.is_system ? "info" : "default"}>
                {role.is_system ? "System Role" : "Custom Role"}
              </StatusBadge>
              <StatusBadge variant={role.is_staff ? "success" : "muted"}>
                {role.is_staff ? "Staff Role" : "Non-staff Role"}
              </StatusBadge>
              <StatusBadge variant={role.is_active ? "success" : "muted"}>
                {role.is_active ? "Active" : "Inactive"}
              </StatusBadge>
            </div>

            {hasLifecycleControls && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Role Lifecycle
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Change whether this role grants permissions or remove an unused custom role.
                  </p>
                </div>

                <RoleLifecycleActions
                  roleId={role.id}
                  roleKey={role.key}
                  roleName={role.display_name ?? role.key}
                  isSystem={role.is_system}
                  isActive={role.is_active}
                  canDeactivate={canDeactivate}
                  canDelete={canDelete}
                  redirectAfterDelete
                />
              </div>
            )}

            {role.is_system && (
              <p className="rounded-xl bg-[#EEF3FB] px-4 py-3 text-sm text-[#203264] dark:bg-slate-800 dark:text-slate-200">
                This built-in role keeps its system classification and key. Its staff classification cannot be changed here.
              </p>
            )}

            {!role.is_system && (
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <Checkbox
                  checked={isStaff}
                  onCheckedChange={(checked) => setIsStaff(checked === true)}
                  disabled={!canUpdate || isPending}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                    Staff role
                  </span>
                  <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                    Staff roles are available to the existing Accounts role-assignment workflow.
                  </span>
                </span>
              </label>
            )}

            {metadataFeedback && (
              <FeedbackMessage feedback={metadataFeedback} />
            )}

            {canUpdate && (
              <FormActions>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Role Details"}
                </Button>
              </FormActions>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Permissions</CardTitle>
          <CardDescription>
            Permissions are grouped by domain for presentation only. The database permission records remain authoritative.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {role.key === "system_admin" && (
            <p className="rounded-xl bg-[#EEF3FB] px-4 py-3 text-sm text-[#203264] dark:bg-slate-800 dark:text-slate-200">
              Existing system administrator permissions cannot be removed in this phase. Additional active permissions may be assigned.
            </p>
          )}

          {role.key === "member" && (
            <p className="rounded-xl bg-[#EEF3FB] px-4 py-3 text-sm text-[#203264] dark:bg-slate-800 dark:text-slate-200">
              The member role must retain profile.view and profile.update.
            </p>
          )}

          <RolePermissionsSelector
            permissions={permissions}
            selectedPermissionIds={selectedPermissionIds}
            protectedPermissionIds={protectedPermissionIds}
            disabled={!canManagePermissions || isPending}
            onToggle={togglePermission}
          />

          {permissionFeedback && (
            <FeedbackMessage feedback={permissionFeedback} />
          )}

          {canManagePermissions && (
            <FormActions>
              <Button
                type="button"
                onClick={handlePermissionSave}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Permissions"}
              </Button>
            </FormActions>
          )}

          {!canManagePermissions && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You have view-only access. roles.manage_permissions is required to change mappings.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href="/portal/administration/roles">Back to Roles</Link>
        </Button>
      </div>
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;

  return (
    <p
      role="status"
      className={feedback.type === "error"
        ? "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300"}
    >
      {feedback.message}
    </p>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}
