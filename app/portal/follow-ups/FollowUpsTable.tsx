"use client";

import { useMemo, useState } from "react";
import { History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  function field(key: keyof typeof filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  const filtered = useMemo(() => filterFollowUps(rows, filters, today), [rows, filters, today]);
  const reversedDates = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  return (
    <section aria-label="Follow-up records" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Search members" htmlFor="follow-ups-search"><Input id="follow-ups-search" type="search" value={filters.search} onChange={(event) => field("search", event.target.value)} placeholder="Member name" /></FormField>
        <FormField label="Branch" htmlFor="follow-ups-branch"><Select id="follow-ups-branch" value={filters.branch} onChange={(event) => field("branch", event.target.value)}>
          <option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.isActive ? "" : " (Inactive branch)"}</option>)}
        </Select></FormField>
        <FormField label="Follow-up date from" htmlFor="follow-ups-from"><Input id="follow-ups-from" type="date" value={filters.dateFrom} onChange={(event) => field("dateFrom", event.target.value)} /></FormField>
        <FormField label="Follow-up date to" htmlFor="follow-ups-to"><Input id="follow-ups-to" type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={(event) => field("dateTo", event.target.value)} /></FormField>
        <div className="flex items-end"><Button type="button" variant="outline" onClick={() => setFilters(initialFilters)}>Clear filters</Button></div>
      </div>
      {reversedDates && <p role="alert" className="text-sm text-red-700">The end date must be on or after the start date.</p>}
      <p role="status" className="text-sm text-slate-500">Showing {filtered.length} of {rows.length} records. Next-date filters use Asia/Manila today ({formatAttendanceDate(today)}), independently of outcome.</p>
      {!rows.length ? <EmptyState title="No follow-ups recorded" description="A record appears only when staff records a follow-up action." /> : (
        <Table className="min-w-[1080px]" aria-label="Historical member follow-ups">
          <TableHeader><TableRow>
            <TableHead>Follow-up Date</TableHead><TableHead>Member</TableHead><TableHead>Branch</TableHead>
            <TableHead><div className="flex items-center gap-1">Method<TableColumnFilter label="Follow-up Method" value={filters.method || "all"} onChange={(value) => field("method", value === "all" ? "" : value)} options={[{ value: "all", label: "All methods" }, ...FOLLOW_UP_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))]} /></div></TableHead>
            <TableHead><div className="flex items-center gap-1">Outcome<TableColumnFilter label="Follow-up Outcome" value={filters.outcome || "all"} onChange={(value) => field("outcome", value === "all" ? "" : value)} options={[{ value: "all", label: "All outcomes" }, ...FOLLOW_UP_OUTCOMES.map((outcome) => ({ value: outcome, label: OUTCOME_LABELS[outcome] }))]} /></div></TableHead>
            <TableHead>Followed Up By</TableHead>
            <TableHead><div className="flex items-center gap-1">Next Follow-up<TableColumnFilter label="Next Follow-up" value={filters.due} onChange={(value) => field("due", value)} options={[{ value: "all", label: "All dates" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due Today" }, { value: "upcoming", label: "Upcoming" }]} /></div></TableHead>
            <TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{!filtered.length ? (
            <TableRow><TableCell colSpan={8}><p role="status" className="py-3 text-center text-sm text-slate-500">No follow-ups match the current filters.</p></TableCell></TableRow>
          ) : filtered.map((row) => {
            const due = getDueStatus(row.nextFollowUpDate, today);
            return <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.followUpDate)}</TableCell>
              <TableCell className="min-w-40 font-medium">{row.memberName}</TableCell>
              <TableCell>{row.branchName}</TableCell><TableCell>{METHOD_LABELS[row.method]}</TableCell>
              <TableCell><FollowUpOutcomeBadge outcome={row.outcome} /></TableCell>
              <TableCell>{row.performerName || "Not specified / account removed"}</TableCell>
              <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.nextFollowUpDate)}{due && <p className="mt-1 text-xs text-slate-500">{due === "today" ? "Due Today" : due === "overdue" ? "Overdue" : "Upcoming"}</p>}</TableCell>
              <TableCell><div className="flex flex-wrap gap-3">
                <TableActionButton href={`/portal/follow-ups/member/${row.memberId}`} icon={<History />}>History</TableActionButton>
                {canUpdate && row.branchIsActive && <TableActionButton href={`/portal/follow-ups/${row.id}/edit`} icon={<Pencil />}>Edit</TableActionButton>}
              </div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      )}
    </section>
  );
}
