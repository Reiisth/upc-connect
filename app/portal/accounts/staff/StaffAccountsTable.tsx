"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  Search,
  SearchX,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";

export type StaffAccountStatus =
  | "active"
  | "invited"
  | "unconfirmed"
  | "banned"
  | "archived"
  | "deleted";

export type StaffBranch = {
  id: string;
  name: string;
  isActive: boolean;
};

export type StaffAccount = {
  id: string;
  displayName: string | null;
  email: string;
  roles: string[];
  branchAccess: StaffBranch[];
  hasAllBranchAccess: boolean;
  status: StaffAccountStatus;
  createdAt: string;
  lastSignInAt: string | null;
};

type StaffAccountsTableProps = {
  accounts: StaffAccount[];
  branches: StaffBranch[];
};

const statusLabels: Record<StaffAccountStatus, string> = {
  active: "Active",
  invited: "Invited",
  unconfirmed: "Unconfirmed",
  banned: "Banned",
  archived: "Archived",
  deleted: "Deleted",
};

const statusVariants: Record<
  StaffAccountStatus,
  "success" | "warning" | "danger" | "muted"
> = {
  active: "success",
  invited: "warning",
  unconfirmed: "warning",
  banned: "danger",
  archived: "muted",
  deleted: "danger",
};

const statusOptions: StaffAccountStatus[] = [
  "active",
  "invited",
  "unconfirmed",
  "banned",
  "archived",
  "deleted",
];

export default function StaffAccountsTable({
  accounts,
  branches,
}: StaffAccountsTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(accounts.flatMap((account) => account.roles)),
      ).sort(),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        account.displayName?.toLowerCase().includes(normalizedSearch) ||
        account.email.toLowerCase().includes(normalizedSearch);

      const matchesRole =
        roleFilter === "all" || account.roles.includes(roleFilter);

      const matchesBranch =
        branchFilter === "all" ||
        account.branchAccess.some(
          (branch) => branch.id === branchFilter,
        ) ||
        (account.hasAllBranchAccess &&
          branches.some(
            (branch) =>
              branch.id === branchFilter && branch.isActive,
          ));

      const matchesStatus =
        statusFilter === "all" || account.status === statusFilter;

      return (
        Boolean(matchesSearch) &&
        matchesRole &&
        matchesBranch &&
        matchesStatus
      );
    });
  }, [accounts, branches, search, roleFilter, branchFilter, statusFilter]);

  const hasFilters =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    branchFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setBranchFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by staff name or email..."
            className="pl-9"
            aria-label="Search staff accounts"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="lg:w-48"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {formatRole(role)}
              </option>
            ))}
          </Select>

          <Select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="lg:w-48"
            aria-label="Filter by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {!branch.isActive ? " (Inactive)" : ""}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="lg:w-44"
            aria-label="Filter by account status"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-[#203264] hover:underline dark:text-slate-400 dark:hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredAccounts.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={
            hasFilters
              ? "No matching staff accounts"
              : "No staff accounts found"
          }
          description={
            hasFilters
              ? "No staff accounts match your current search or filters. Try adjusting them."
              : "Staff accounts will appear here once staff roles are assigned."
          }
        />
      ) : (
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Branch Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sign-in</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <TableActionButton
                    href={`/portal/accounts/staff/${account.id}`}
                    icon={<ExternalLink />}
                  >
                    {account.displayName ?? "Unnamed Staff"}
                  </TableActionButton>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {account.email}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {account.roles.map((role) => (
                      <StatusBadge key={role} variant="info">
                        {formatRole(role)}
                      </StatusBadge>
                    ))}
                  </div>
                </TableCell>

                <TableCell>
                  {account.hasAllBranchAccess ? (
                    <StatusBadge variant="info">
                      All active branches
                    </StatusBadge>
                  ) : account.branchAccess.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {account.branchAccess.map((branch) => (
                        <StatusBadge
                          key={branch.id}
                          variant={branch.isActive ? "info" : "muted"}
                        >
                          {branch.name}
                          {!branch.isActive ? " (Inactive)" : ""}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <StatusBadge variant="muted">
                      No branches assigned
                    </StatusBadge>
                  )}
                </TableCell>

                <TableCell>
                  <StatusBadge variant={statusVariants[account.status]}>
                    {statusLabels[account.status]}
                  </StatusBadge>
                </TableCell>

                <TableCell className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                  {formatDate(account.lastSignInAt)}
                </TableCell>

                <TableCell className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                  {formatDate(account.createdAt)}
                </TableCell>

                <TableCell>
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    Read-only
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function formatRole(role: string) {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
