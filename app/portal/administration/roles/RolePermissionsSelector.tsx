"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";

import type { PermissionRecord } from "./types";

type RolePermissionsSelectorProps = {
  permissions: PermissionRecord[];
  selectedPermissionIds: string[];
  protectedPermissionIds?: readonly string[];
  disabled?: boolean;
  onToggle: (permissionId: string, checked: boolean) => void;
};

const groupLabels: Record<string, string> = {
  accounts: "Accounts",
  administration: "Administration",
  attendance: "Attendance",
  baptisms: "Baptisms",
  branches: "Branches",
  contributions: "Contributions",
  dashboard: "Dashboard",
  members: "Members",
  profile: "Profile",
  reports: "Reports",
  roles: "Roles",
  services: "Services",
};

function getGroupKey(permissionKey: string) {
  return permissionKey.split(".")[0] ?? permissionKey;
}

function getGroupLabel(groupKey: string) {
  return groupLabels[groupKey] ?? groupKey;
}

function getPermissionLabel(permission: PermissionRecord) {
  const databaseName = permission.name?.trim();

  if (databaseName && databaseName !== permission.key) {
    return databaseName;
  }

  const segments = permission.key.split(".");
  const action = segments.at(-1) ?? permission.key;

  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function RolePermissionsSelector({
  permissions,
  selectedPermissionIds,
  protectedPermissionIds = [],
  disabled = false,
  onToggle,
}: RolePermissionsSelectorProps) {
  const selectedIds = new Set(selectedPermissionIds);
  const protectedIds = new Set(protectedPermissionIds);
  const groups = new Map<string, PermissionRecord[]>();

  for (const permission of permissions) {
    const groupKey = getGroupKey(permission.key);
    const group = groups.get(groupKey) ?? [];
    group.push(permission);
    groups.set(groupKey, group);
  }

  if (permissions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No active permissions are available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([groupKey, groupPermissions]) => (
        <div key={groupKey}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-prompt text-sm font-semibold text-[#203264] dark:text-slate-100">
              {getGroupLabel(groupKey)}
            </h3>

            <span className="text-xs text-slate-500 dark:text-slate-400">
              {groupPermissions.length} permission{groupPermissions.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {groupPermissions.map((permission) => {
              const selected = selectedIds.has(permission.id);
              const isProtected = protectedIds.has(permission.id);
              const isUnavailable = !permission.is_active && !selected;

              return (
                <label
                  key={permission.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                    disabled || isUnavailable
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer hover:border-[#5D94E8] dark:hover:border-[#8DB5F0]"
                  } border-slate-200 dark:border-slate-700`}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled || isProtected || isUnavailable}
                    onCheckedChange={(checked) =>
                      onToggle(permission.id, checked === true)
                    }
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {getPermissionLabel(permission)}
                      </span>

                      {isProtected && (
                        <StatusBadge variant="info">Protected</StatusBadge>
                      )}

                      {!permission.is_active && (
                        <StatusBadge variant="muted">Inactive</StatusBadge>
                      )}
                    </span>

                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      {permission.key}
                    </span>

                    {permission.description && (
                      <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {permission.description}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
