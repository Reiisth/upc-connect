"use client";

import { useMemo, useState } from "react";
import { Search, ClipboardPen, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import {
  filterInactivityRows, formatAttendanceDate, formatRecentRate, getDerivedStatus,
  type DerivedInactivityStatus, type InactivityMemberRow,
} from "@/lib/inactivity/presentation";

export default function InactivityTable({ rows, canCreateFollowUps = false, canViewFollowUps = false }: {
  rows: InactivityMemberRow[]; canCreateFollowUps?: boolean; canViewFollowUps?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DerivedInactivityStatus | "all">("all");
  const [minimum, setMinimum] = useState("");
  const filtered = useMemo(() => filterInactivityRows(rows, {
    search, status, minimumAbsences: Number(minimum) || 0,
  }), [rows, search, status, minimum]);
  const hasFilters = Boolean(search || status !== "all" || minimum);

  return (
    <section aria-label="Member inactivity results" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <FormField label="Search members" htmlFor="inactivity-search" className="md:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input id="inactivity-search" type="search" placeholder="Search by member name" className="pl-9"
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </FormField>
        <FormField label="Derived status" htmlFor="inactivity-status">
          <Select id="inactivity-status" value={status} onChange={(event) => setStatus(event.target.value as DerivedInactivityStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="unknown">Unknown</option>
          </Select>
        </FormField>
        <FormField label="Minimum absent weeks" htmlFor="inactivity-minimum">
          <Input id="inactivity-minimum" type="number" min={0} step={1} placeholder="Any"
            value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm text-slate-500">
          Showing {filtered.length.toLocaleString("en-PH")} of {rows.length.toLocaleString("en-PH")} monitored members
        </p>
        {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={() => {
          setSearch(""); setStatus("all"); setMinimum("");
        }}>Clear filters</Button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={rows.length ? "No matching members" : "No members to monitor"}
          description={rows.length ? "Try another name or adjust the filters." : "This branch has no non-archived member records."} />
      ) : (
        <>
          <p className="text-xs text-slate-500 md:hidden">Swipe the table to see all attendance details.</p>
          <Table className="min-w-[880px]" aria-label="Derived weekly inactivity by member">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Derived Status</TableHead>
                <TableHead>Absent Weeks</TableHead>
                <TableHead>Branch Threshold</TableHead>
                <TableHead>Last Attendance</TableHead>
                <TableHead>Recent Rate</TableHead>
                {(canCreateFollowUps || canViewFollowUps) && <TableHead>Follow-ups</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const derivedStatus = getDerivedStatus(row);
                return (
                  <TableRow key={row.memberId}>
                    <TableCell className="min-w-48 max-w-xs">
                      <p className="font-medium text-slate-900">{row.memberName}</p>
                      {derivedStatus === "unknown" && (
                        <p className="mt-1 text-xs text-slate-500">Missing or invalid first attendance date</p>
                      )}
                      {row.calculationStatus === "evaluated" && row.recentEligibleWeeks === 0 && (
                        <p className="mt-1 text-xs text-slate-500">No eligible completed weeks yet</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={derivedStatus === "inactive" ? "danger" : derivedStatus === "active" ? "success" : "muted"}>
                        {derivedStatus === "inactive" ? "Inactive" : derivedStatus === "active" ? "Active" : "Unknown"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.consecutiveAbsentWeeks === null ? "—" : `${row.consecutiveAbsentWeeks} / ${row.inactivityThresholdWeeks} weeks`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{row.inactivityThresholdWeeks} {row.inactivityThresholdWeeks === 1 ? "week" : "weeks"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.lastAttendedDate)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatRecentRate(row)}</TableCell>
                    {(canCreateFollowUps || canViewFollowUps) && <TableCell>
                      <div className="flex min-w-44 flex-col items-start gap-2">
                        {canCreateFollowUps && <TableActionButton href={`/portal/follow-ups/new?memberId=${row.memberId}&branchId=${row.branchId}`}
                          icon={<ClipboardPen />} className={derivedStatus === "inactive" ? "text-[#203264]" : undefined}>Record Follow-up</TableActionButton>}
                        {canViewFollowUps && <TableActionButton href={`/portal/follow-ups/member/${row.memberId}`} icon={<History />}>View Follow-ups</TableActionButton>}
                      </div>
                    </TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
      <p className="text-xs text-slate-500">
        Rate uses up to 8 eligible finished weeks and does not determine activity status. Last attendance can include this week.
      </p>
    </section>
  );
}
