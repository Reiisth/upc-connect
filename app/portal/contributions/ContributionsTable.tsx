"use client";

import {
  DollarSign,
  Pencil,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

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

import {
  CONTRIBUTION_TYPES,
  formatContributionType,
  formatPaymentMethod,
  PAYMENT_METHODS,
  type ContributionBranch,
  type ContributionRecord,
} from "./types";

type ContributionsTableProps = {
  records: ContributionRecord[];
  branches: ContributionBranch[];
  canManage: boolean;
};

const contributionTypeVariants: Record<
  ContributionRecord["contributionType"],
  "success" | "info" | "muted"
> = {
  tithe: "success",
  love_offering: "info",
  other: "muted",
};

export default function ContributionsTable({
  records,
  branches,
  canManage,
}: ContributionsTableProps) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const contributorName = record.memberName ?? "Anonymous";
        const matchesSearch =
          !normalizedSearch ||
          contributorName.toLowerCase().includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          record.churchBranchId === branchFilter;
        const matchesType =
          typeFilter === "all" ||
          record.contributionType === typeFilter;
        const matchesPayment =
          paymentFilter === "all" ||
          record.paymentMethod === paymentFilter;
        const matchesDateFrom =
          !dateFrom || record.contributionDate >= dateFrom;
        const matchesDateTo =
          !dateTo || record.contributionDate <= dateTo;

        return (
          matchesSearch &&
          matchesBranch &&
          matchesType &&
          matchesPayment &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort(compareContributions);
  }, [
    records,
    search,
    branchFilter,
    typeFilter,
    paymentFilter,
    dateFrom,
    dateTo,
  ]);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    paymentFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
    setTypeFilter("all");
    setPaymentFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by member name..."
            className="pl-9"
            aria-label="Search contributions by member name"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filter contributions by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>

          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filter contributions by type"
          >
            <option value="all">All types</option>
            {CONTRIBUTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatContributionType(type)}
              </option>
            ))}
          </Select>

          <Select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            aria-label="Filter contributions by payment method"
          >
            <option value="all">All payment methods</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {formatPaymentMethod(method)}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Contributions from date"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Contributions to date"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="self-start text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-[#203264] hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={hasFilters ? "No matching contributions" : "No contributions found"}
          description={
            hasFilters
              ? "No contributions match your current search or filters. Try adjusting them."
              : "Record a contribution to begin building the branch financial history."
          }
        />
      ) : (
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="whitespace-nowrap">
                  {formatContributionDate(record.contributionDate)}
                </TableCell>

                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#EEF3FB] p-2 text-[#203264] dark:bg-slate-800 dark:text-slate-200">
                      <DollarSign className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {record.memberName ?? "Anonymous"}
                      </p>

                      {record.notes && (
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge
                    variant={
                      contributionTypeVariants[
                        record.contributionType
                      ]
                    }
                  >
                    {formatContributionType(record.contributionType)}
                  </StatusBadge>
                </TableCell>

                <TableCell>
                  {record.branch ? (
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {record.branch.name}
                      </p>

                      {record.branch.code && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {record.branch.code}
                        </p>
                      )}
                    </div>
                  ) : (
                    <StatusBadge variant="muted">
                      Unknown branch
                    </StatusBadge>
                  )}
                </TableCell>

                <TableCell>
                  {record.serviceName ?? "—"}
                </TableCell>

                <TableCell>
                  {formatPaymentMethod(record.paymentMethod)}
                </TableCell>

                <TableCell className="whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                  {formatAmount(record.amount)}
                </TableCell>

                <TableCell>
                  {record.recordedByName ??
                    (record.recordedBy ? "Staff account" : "—")}
                </TableCell>

                <TableCell>
                  {canManage ? (
                    <TableActionButton
                      href={`/portal/contributions/${record.id}/edit`}
                      icon={<Pencil />}
                    >
                      Edit
                    </TableActionButton>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      View only
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function compareContributions(
  first: ContributionRecord,
  second: ContributionRecord,
) {
  return second.contributionDate.localeCompare(
    first.contributionDate,
  );
}

export function formatAmount(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatContributionDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}
