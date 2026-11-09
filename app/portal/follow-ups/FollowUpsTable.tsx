"use client";

import { useMemo, useState } from "react";
import { History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { formatAttendanceDate } from "@/lib/inactivity/presentation";
import { FollowUpOutcomeBadge } from "./FollowUpOutcomeBadge";
import { filterFollowUps, getDueStatus, FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES, METHOD_LABELS, OUTCOME_LABELS,
  type DueFilter, type FollowUpBranch, type FollowUpRecord } from "./types";

const initialFilters = { search: "", branch: "", method: "", outcome: "", dateFrom: "", dateTo: "", due: "all" as DueFilter };

export default function FollowUpsTable({ rows, branches, today, canUpdate }: {
  rows: FollowUpRecord[]; branches: FollowUpBranch[]; today: string; canUpdate: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeError, setRangeError] = useState("");
  function choosePeriod(value: string) {
    setPeriod(value); setRangeError("");
    if (value === "custom") return;
    setDateTo(value === "all" ? "" : today);
    setDateFrom(value === "all" ? "" : value === "month" ? `${today.slice(0, 7)}-01` : value === "year" ? `${today.slice(0, 4)}-01-01` : new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10));
  }
  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) { setRangeError("The end date must be on or after the start date."); return; }
    setFilters(current => ({ ...current, dateFrom, dateTo })); setPage(1); setRangeError("");
  }
  function field(key: keyof typeof filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); setPage(1); }
  const filtered = useMemo(() => filterFollowUps(rows, filters, today), [rows, filters, today]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const hasClearableFilters = Boolean(filters.search.trim() || filters.branch || filters.method || filters.outcome || filters.due !== "all");
  function clearFilters() {
    setPage(1);
    setFilters((current) => ({ ...current, search: "", branch: "", method: "", outcome: "", due: "all" }));
  }
  return (
    <section aria-label="Follow-up records" className="space-y-4">
      <form onSubmit={applyRange} aria-label="Follow-up date range">
        <fieldset aria-labelledby="follow-ups-range-title" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <h2 id="follow-ups-range-title" className="mb-3 text-sm font-semibold text-[#203264]">Follow-up date range</h2>
          <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <FormField label="Period" htmlFor="follow-ups-period" className="col-span-2 lg:col-span-1">
              <Select id="follow-ups-period" value={period} onChange={e => choosePeriod(e.target.value)}>
                <option value="all">All time</option><option value="month">This month</option><option value="last30">Last 30 days</option><option value="year">Year to date</option><option value="custom">Custom range</option>
              </Select>
            </FormField>
            <FormField label="From" htmlFor="follow-ups-from"><Input id="follow-ups-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={e => { setDateFrom(e.target.value); setPeriod("custom"); }} aria-invalid={Boolean(rangeError)} /></FormField>
            <FormField label="To" htmlFor="follow-ups-to"><Input id="follow-ups-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={e => { setDateTo(e.target.value); setPeriod("custom"); }} aria-invalid={Boolean(rangeError)} /></FormField>
            <Button type="submit" className="col-span-2 lg:col-span-1">Apply range</Button>
          </div>
          {rangeError && <p role="alert" className="mt-2 text-sm text-red-700">{rangeError}</p>}
        </fieldset>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Search members" htmlFor="follow-ups-search"><Input id="follow-ups-search" type="search" value={filters.search} onChange={(event) => field("search", event.target.value)} placeholder="Member name" /></FormField>
        <FormField label="Branch" htmlFor="follow-ups-branch"><Select id="follow-ups-branch" value={filters.branch} onChange={(event) => field("branch", event.target.value)}>
          <option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.isActive ? "" : " (Inactive branch)"}</option>)}
        </Select></FormField>
        {hasClearableFilters && <div className="flex items-end"><ClearFiltersButton onClick={clearFilters} /></div>}
      </div>
      {!rows.length ? <EmptyState title="No follow-ups recorded" description="A record appears only when staff records a follow-up action." /> : (
        <Table className="min-w-[1080px]" aria-label="Historical member follow-ups">
          <TableHeader><TableRow>
            <TableHead>Follow-up Date</TableHead><TableHead>Member</TableHead>
            <TableHead><div className="flex items-center gap-1">Method<TableColumnFilter label="Follow-up Method" value={filters.method || "all"} onChange={(value) => field("method", value === "all" ? "" : value)} options={[{ value: "all", label: "All methods" }, ...FOLLOW_UP_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))]} /></div></TableHead>
            <TableHead><div className="flex items-center gap-1">Outcome<TableColumnFilter label="Follow-up Outcome" value={filters.outcome || "all"} onChange={(value) => field("outcome", value === "all" ? "" : value)} options={[{ value: "all", label: "All outcomes" }, ...FOLLOW_UP_OUTCOMES.map((outcome) => ({ value: outcome, label: OUTCOME_LABELS[outcome] }))]} /></div></TableHead>
            <TableHead>Followed Up By</TableHead>
            <TableHead><div className="flex items-center gap-1">Next Follow-up<TableColumnFilter label="Next Follow-up" value={filters.due} onChange={(value) => field("due", value)} options={[{ value: "all", label: "All dates" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due Today" }, { value: "upcoming", label: "Upcoming" }]} /></div></TableHead>
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{!filtered.length ? (
            <TableRow><TableCell colSpan={7}><p role="status" className="py-3 text-center text-sm text-slate-500">No follow-ups match the current filters.</p></TableCell></TableRow>
          ) : pageRows.map((row) => {
            const due = getDueStatus(row.nextFollowUpDate, today);
            return <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.followUpDate)}</TableCell>
              <TableCell className="min-w-40"><p className="font-medium">{row.memberName}</p><p className="mt-1 text-xs text-slate-500">{row.branchName}</p></TableCell><TableCell>{METHOD_LABELS[row.method]}</TableCell>
              <TableCell><FollowUpOutcomeBadge outcome={row.outcome} /></TableCell>
              <TableCell>{row.performerName || "Not specified / account removed"}</TableCell>
              <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.nextFollowUpDate)}{due && <p className="mt-1 text-xs text-slate-500">{due === "today" ? "Due Today" : due === "overdue" ? "Overdue" : "Upcoming"}</p>}</TableCell>
              <TableCell><div className="flex flex-wrap gap-3">
                <TableActionButton href={`/portal/follow-ups/member/${row.memberId}?returnTo=/portal/follow-ups`} icon={<History />}>History</TableActionButton>
                {canUpdate && row.branchIsActive && <TableActionButton href={`/portal/follow-ups/${row.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
              </div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      )}
      {filtered.length > 0 && <nav aria-label="Follow-ups pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-slate-500">Showing {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, filtered.length)} of {filtered.length} records</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>
      </nav>}
    </section>
  );
}
