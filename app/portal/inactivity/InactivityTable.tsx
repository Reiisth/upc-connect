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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AttendanceFlag | "all">("all");
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
        <FormField label="Attendance flag" htmlFor="inactivity-status">
          <Select id="inactivity-status" value={status} onChange={(event) => setStatus(event.target.value as AttendanceFlag | "all")}>
            <option value="all">All statuses</option>
            <option value="monitoring">Monitoring</option>
            <option value="needs_follow_up">Needs Follow-up</option>
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
          <Table className="min-w-[1000px]" aria-label="Weekly attendance follow-up flags by member">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                {canViewMemberStatus && <TableHead>Member Status</TableHead>}
                <TableHead>Attendance Flag</TableHead>
                <TableHead>Absent Weeks</TableHead>
                <TableHead>Branch Threshold</TableHead>
                <TableHead>Last Attendance</TableHead>
                <TableHead>Recent Rate</TableHead>
                {(canCreateFollowUps || canViewFollowUps) && <TableHead>Follow-ups</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const derivedStatus = getAttendanceFlag(row);
                return (
                  <TableRow key={row.memberId}>
                    <TableCell className="min-w-48 max-w-xs text-left">
                      <p className="font-medium text-slate-900">{row.memberName}</p>
                      {derivedStatus === "unknown" && (
                        <p className="mt-1 text-xs text-slate-500">Missing or invalid first attendance date</p>
                      )}
                      {row.calculationStatus === "evaluated" && row.recentEligibleWeeks === 0 && (
                        <p className="mt-1 text-xs text-slate-500">No eligible completed weeks yet</p>
                      )}
                    </TableCell>
                    {canViewMemberStatus && <TableCell>
                      <StatusBadge variant={row.memberStatus === "active" ? "success" : row.memberStatus === "inactive" ? "muted" : "muted"}>
                        {row.memberStatus ?? "Unknown"}
                      </StatusBadge>
                    </TableCell>}
                    <TableCell>
                      <StatusBadge variant={derivedStatus === "needs_follow_up" ? "warning" : derivedStatus === "monitoring" ? "success" : "muted"}>
                        {derivedStatus === "needs_follow_up" ? "Needs Follow-up" : derivedStatus === "monitoring" ? "Monitoring" : "Unknown"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.consecutiveAbsentWeeks === null ? "—" : `${row.consecutiveAbsentWeeks} / ${row.inactivityThresholdWeeks} weeks`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{row.inactivityThresholdWeeks} {row.inactivityThresholdWeeks === 1 ? "week" : "weeks"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAttendanceDate(row.lastAttendedDate)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatRecentRate(row)}</TableCell>
                    {(canCreateFollowUps || canViewFollowUps || canUpdateMemberStatus) && <TableCell>
                      <div className="flex min-w-44 flex-col items-start gap-2">
                        {canCreateFollowUps && derivedStatus === "needs_follow_up" && <TableActionButton href={`/portal/follow-ups/new?memberId=${row.memberId}&branchId=${row.branchId}`}
                          icon={<ClipboardPen />} className="text-[#203264]">Record Follow-up</TableActionButton>}
                        {canViewFollowUps && <TableActionButton href={`/portal/follow-ups/member/${row.memberId}`} icon={<History />}>View Follow-ups</TableActionButton>}
                        {canUpdateMemberStatus && <TableActionButton href={`/portal/members/${row.memberId}/edit`} icon={<UserRoundCog />}>Review Member Status</TableActionButton>}
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
        Attendance flags use up to 8 eligible finished weeks and never change Member Status. Last attendance can include this week.
      </p>
    </section>
  );
}
