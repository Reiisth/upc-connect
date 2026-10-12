"use client";

import {
  HeartHandshake,
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
  formatWeddingDate,
  type WeddingBranch,
  type WeddingRecord,
} from "./types";

type WeddingsTableProps = {
  records: WeddingRecord[];
  branches: WeddingBranch[];
  canUpdate: boolean;
};

export default function WeddingsTable({
  records,
  branches,
  canUpdate,
}: WeddingsTableProps) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const searchableText = [
          record.memberName,
          record.spouseDisplayName,
          record.certificateNumber ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const matchesSearch =
          !normalizedSearch || searchableText.includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          record.churchBranchId === branchFilter;
        const matchesDateFrom =
          !dateFrom || record.weddingDate >= dateFrom;
        const matchesDateTo = !dateTo || record.weddingDate <= dateTo;

        return (
          matchesSearch &&
          matchesBranch &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort((first, second) =>
        second.weddingDate.localeCompare(first.weddingDate),
      );
  }, [records, search, branchFilter, dateFrom, dateTo]);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
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
            placeholder="Search by member, spouse, or certificate..."
            className="pl-9"
            aria-label="Search wedding records"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Filter weddings by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Wedding records from date"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Wedding records to date"
          />

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-left text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-[#203264] hover:underline dark:text-slate-400 dark:hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={
            hasFilters
              ? "No matching wedding records"
              : "No wedding records found"
          }
          description={
            hasFilters
              ? "No records match your current search or filters. Try adjusting them."
              : "Create a wedding record to begin building the church history."
          }
        />
      ) : (
        <Table className="min-w-[1300px]">
          <TableHeader>
            <TableRow>
              <TableHead>Wedding Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Spouse</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Officiated By</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Certificate Number</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="whitespace-nowrap">
                  {formatWeddingDate(record.weddingDate)}
                </TableCell>

                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#EEF3FB] p-2 text-[#203264] dark:bg-slate-800 dark:text-slate-200">
                      <HeartHandshake className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {record.memberName}
                      </p>

                      {record.memberIsArchived ||
                      record.memberStatus !== "active" ? (
                        <StatusBadge
                          variant="muted"
                          className="mt-1"
                        >
                          Historical member link
                        </StatusBadge>
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
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {record.spouseDisplayName}
                  </p>

                  {record.spouseMemberId && record.spouseMemberIsArchived ? (
                    <StatusBadge variant="muted" className="mt-1">
                      Historical member link
                    </StatusBadge>
                  ) : null}
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

                <TableCell>{record.officiatedBy ?? "—"}</TableCell>
                <TableCell>{record.location ?? "—"}</TableCell>
                <TableCell>{record.certificateNumber ?? "—"}</TableCell>
                <TableCell>
                  {record.recordedByName ??
                    (record.recordedBy ? "Staff account" : "—")}
                </TableCell>

                <TableCell>
                  {canUpdate ? (
                    <TableActionButton
                      href={`/portal/weddings/${record.id}/edit`}
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
