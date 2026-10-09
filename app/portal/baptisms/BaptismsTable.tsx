"use client";

import {
  Droplets,
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
  BAPTISM_TYPES,
  formatBaptismType,
  type BaptismBranch,
  type BaptismRecord,
  type BaptismType,
} from "./types";

type BaptismsTableProps = {
  records: BaptismRecord[];
  branches: BaptismBranch[];
  canManage: boolean;
};

const baptismTypeVariants: Record<
  BaptismType,
  "success" | "info"
> = {
  water: "info",
  holy_ghost: "success",
};

export default function BaptismsTable({
  records,
  branches,
  canManage,
}: BaptismsTableProps) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const matchesSearch =
          !normalizedSearch ||
          record.memberName.toLowerCase().includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          record.churchBranchId === branchFilter;
        const matchesType =
          typeFilter === "all" ||
          record.baptismType === typeFilter;
        const matchesDateFrom =
          !dateFrom ||
          (record.baptismDate !== null &&
            record.baptismDate >= dateFrom);
        const matchesDateTo =
          !dateTo ||
          (record.baptismDate !== null &&
            record.baptismDate <= dateTo);

        return (
          matchesSearch &&
          matchesBranch &&
          matchesType &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort(compareBaptisms);
  }, [records, search, branchFilter, typeFilter, dateFrom, dateTo]);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
    setTypeFilter("all");
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
            aria-label="Search baptism records by member name"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filter baptisms by branch"
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
            aria-label="Filter baptisms by type"
          >
            <option value="all">All baptism types</option>
            {BAPTISM_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatBaptismType(type)}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Baptisms from date"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Baptisms to date"
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
          title={
            hasFilters
              ? "No matching baptism records"
              : "No baptism records found"
          }
          description={
            hasFilters
              ? "No records match your current search or filters. Try adjusting them."
              : "Create a baptism record to begin building the ministry history."
          }
        />
      ) : (
        <Table className="min-w-[1250px]">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Baptism Type</TableHead>
              <TableHead>Baptism Date</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Officiated By</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#EEF3FB] p-2 text-[#203264] dark:bg-slate-800 dark:text-slate-200">
                      <Droplets className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {record.memberName}
                      </p>

                      {(!record.memberIsArchived &&
                        record.memberStatus !== "active") ||
                      record.memberIsArchived ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Historical member link
                        </p>
                      ) : null}

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
                    variant={baptismTypeVariants[record.baptismType]}
                  >
                    {formatBaptismType(record.baptismType)}
                  </StatusBadge>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {formatBaptismDate(record.baptismDate)}
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
                  {record.officiatedBy ?? "—"}
                </TableCell>

                <TableCell>{record.location ?? "—"}</TableCell>

                <TableCell>
                  {record.recordedByName ??
                    (record.recordedBy ? "Staff account" : "—")}
                </TableCell>

                <TableCell>
                  {canManage ? (
                    <TableActionButton
                      href={`/portal/baptisms/${record.id}/edit`}
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

function compareBaptisms(
  first: BaptismRecord,
  second: BaptismRecord,
) {
  if (!first.baptismDate && !second.baptismDate) return 0;
  if (!first.baptismDate) return 1;
  if (!second.baptismDate) return -1;

  return second.baptismDate.localeCompare(first.baptismDate);
}

function formatBaptismDate(value: string | null) {
  if (!value) return "Date unknown";

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "Date unknown";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}
