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
        <FormField label="Outcome" htmlFor="follow-ups-outcome"><Select id="follow-ups-outcome" value={filters.outcome} onChange={(event) => field("outcome", event.target.value)}>
          <option value="">All outcomes</option>{FOLLOW_UP_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{OUTCOME_LABELS[outcome]}</option>)}
        </Select></FormField>
        <FormField label="Method" htmlFor="follow-ups-method"><Select id="follow-ups-method" value={filters.method} onChange={(event) => field("method", event.target.value)}>
          <option value="">All methods</option>{FOLLOW_UP_METHODS.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
        </Select></FormField>
        <FormField label="Follow-up date from" htmlFor="follow-ups-from"><Input id="follow-ups-from" type="date" value={filters.dateFrom} onChange={(event) => field("dateFrom", event.target.value)} /></FormField>
        <FormField label="Follow-up date to" htmlFor="follow-ups-to"><Input id="follow-ups-to" type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={(event) => field("dateTo", event.target.value)} /></FormField>
        <FormField label="Next follow-up" htmlFor="follow-ups-due"><Select id="follow-ups-due" value={filters.due} onChange={(event) => field("due", event.target.value)}>
          <option value="all">All dates</option><option value="overdue">Overdue</option><option value="today">Due Today</option><option value="upcoming">Upcoming</option>
        </Select></FormField>
        <div className="flex items-end"><Button type="button" variant="outline" onClick={() => setFilters(initialFilters)}>Clear filters</Button></div>
      </div>
      {reversedDates && <p role="alert" className="text-sm text-red-700">The end date must be on or after the start date.</p>}
      <p role="status" className="text-sm text-slate-500">Showing {filtered.length} of {rows.length} records. Next-date filters use Asia/Manila today ({formatAttendanceDate(today)}), independently of outcome.</p>
      {!filtered.length ? <EmptyState title={rows.length ? "No matching follow-ups" : "No follow-ups recorded"} description="A record appears only when staff records a follow-up action." /> : (
        <Table className="min-w-[1080px]" aria-label="Historical member follow-ups">
          <TableHeader><TableRow>{["Follow-up Date", "Member", "Branch", "Method", "Outcome", "Followed Up By", "Next Follow-up", "Actions"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{filtered.map((row) => {
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
