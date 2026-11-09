"use client";

import { useMemo, useState } from "react";
import { Search, ClipboardPen, History, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import {
  filterInactivityRows, formatAttendanceDate, formatRecentRate, getAttendanceFlag,
  type AttendanceFlag, type InactivityMemberRow,
} from "@/lib/inactivity/presentation";

export default function InactivityTable({ rows, canCreateFollowUps = false, canViewFollowUps = false, canViewMemberStatus = false, canUpdateMemberStatus = false }: {
  rows: InactivityMemberRow[]; canCreateFollowUps?: boolean; canViewFollowUps?: boolean; canViewMemberStatus?: boolean; canUpdateMemberStatus?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AttendanceFlag | "all">("all");
  const [minimum, setMinimum] = useState("");
  const filtered = useMemo(() => filterInactivityRows(rows, {
    search, status, minimumAbsences: Number(minimum) || 0,
  }), [rows, search, status, minimum]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const hasFilters = Boolean(search || status !== "all" || minimum);

  return (
    <section aria-label="Member inactivity results" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <FormField label="Search members" htmlFor="inactivity-search" className="md:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input id="inactivity-search" type="search" placeholder="Search by member name" className="pl-9"
              value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
        </FormField>
        <FormField label="Attendance flag" htmlFor="inactivity-status">
          <Select id="inactivity-status" value={status} onChange={(event) => { setStatus(event.target.value as AttendanceFlag | "all"); setPage(1); }}>
            <option value="all">All statuses</option>
            <option value="monitoring">Monitoring</option>
            <option value="needs_follow_up">Needs Follow-up</option>
            <option value="unknown">Unknown</option>
          </Select>
        </FormField>
        <FormField label="Minimum absent weeks" htmlFor="inactivity-minimum">
          <Input id="inactivity-minimum" type="number" min={0} step={1} placeholder="Any"
            value={minimum} onChange={(event) => { setMinimum(event.target.value); setPage(1); }} />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={() => {
          setSearch(""); setStatus("all"); setMinimum(""); setPage(1);
        }}>Clear filters</Button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={rows.length ? "No matching members" : "No members to monitor"}
          description={rows.length ? "Try another name or adjust the filters." : "This branch has no non-archived member records."} />
      ) : (
        <>
          <p className="text-xs text-slate-500 md:hidden">Swipe the table to see all attendance details.</p>
          <Table className="min-w-[700px]" aria-label="Weekly attendance follow-up flags by member">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Absent Weeks</TableHead>
                <TableHead>Last Attendance</TableHead>
                <TableHead>Recent Rate</TableHead>
                {(canCreateFollowUps || canViewFollowUps || canUpdateMemberStatus) && <TableHead>Follow-ups</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const derivedStatus = getAttendanceFlag(row);
                return (
                  <TableRow key={row.memberId}>
                    <TableCell className="min-w-48 max-w-xs text-left">
                      <div className="flex items-center gap-2">
                        {canViewMemberStatus && <span className="group relative flex shrink-0 items-center">
                          <span role="img" tabIndex={0}
                            aria-label={`Member status: ${row.memberStatus ?? "unknown"}`}
                            aria-describedby={`member-status-${row.memberId}`}
                            className={`h-2.5 w-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${row.memberStatus === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                          <span id={`member-status-${row.memberId}`} role="tooltip"
                            className={`pointer-events-none absolute left-0 top-full z-50 mt-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-within:block ${row.memberStatus === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
                            {row.memberStatus === "active" ? "Active" : row.memberStatus === "inactive" ? "Inactive" : "Unknown"}
                          </span>
                        </span>}
                        <p className="font-medium text-slate-900">{row.memberName}</p>
                      </div>
                      <div className={canViewMemberStatus ? "mt-1 pl-[18px]" : "mt-1"}>
                        <StatusBadge variant={derivedStatus === "needs_follow_up" ? "warning" : derivedStatus === "monitoring" ? "success" : "muted"}>
                          {derivedStatus === "needs_follow_up" ? "Needs Follow-up" : derivedStatus === "monitoring" ? "Monitoring" : "Unknown"}
                        </StatusBadge>
                      </div>
                      {derivedStatus === "unknown" && (
                        <p className="mt-1 text-xs text-slate-500">Missing or invalid UPC Connect registration date</p>
                      )}
                      {row.calculationStatus === "evaluated" && row.recentEligibleWeeks === 0 && (
                        <p className="mt-1 text-xs text-slate-500">No eligible completed weeks yet</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.consecutiveAbsentWeeks === null ? "—" : `${row.consecutiveAbsentWeeks} / ${row.inactivityThresholdWeeks} weeks`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.lastAttendedDate)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatRecentRate(row)}</TableCell>
                    {(canCreateFollowUps || canViewFollowUps || canUpdateMemberStatus) && <TableCell>
                      <div className="flex min-w-44 flex-col items-start gap-2">
                        {canCreateFollowUps && derivedStatus === "needs_follow_up" && <TableActionButton href={`/portal/follow-ups/new?memberId=${row.memberId}&branchId=${row.branchId}`}
                          icon={<ClipboardPen />} className="text-[#203264]">Record Follow-up</TableActionButton>}
                        {canViewFollowUps && <TableActionButton href={`/portal/follow-ups/member/${row.memberId}?returnTo=/portal/inactivity`} icon={<History />}>View Follow-ups</TableActionButton>}
                        {canUpdateMemberStatus && <TableActionButton href={`/portal/members/${row.memberId}/edit`} icon={<UserRoundCog />}>Review Member Status</TableActionButton>}
                      </div>
                    </TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <nav aria-label="Inactivity pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-sm text-slate-500">Showing {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, filtered.length)} of {filtered.length} members</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </nav>
        </>
      )}
      <p className="text-xs text-slate-500">
        Attendance flags use consecutive eligible absent weeks; the recent rate uses up to 8 eligible finished weeks and never change Member Status. Last attendance can include this week.
      </p>
    </section>
  );
}
