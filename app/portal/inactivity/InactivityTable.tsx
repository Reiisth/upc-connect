"use client";
import { SearchInput, TableToolbar } from "@/components/ui/table-toolbar";

import { MemberStatus } from "@/components/ui/member-status";

import { Card, CardContent } from "@/components/ui/card";

import { Pagination } from "@/components/ui/pagination";


import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck, CircleHelp, UsersRound, ClipboardPen, History, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import { getMonitoringCounts, filterInactivityRows, formatAttendanceDate, formatRecentRate, getAttendanceFlag, type AttendanceFlag, type InactivityMemberRow } from "@/lib/inactivity/presentation";

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

  const counts = getMonitoringCounts(filtered);

  return (
    <section aria-label="Member inactivity results" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Selected branch monitoring totals">
            {[
              { label: "Total Monitored", value: counts.total, icon: UsersRound, note: "Non-archived branch members" },
              { label: "Monitoring", value: counts.monitoring, icon: CircleCheck, note: "Below the follow-up threshold" },
              { label: "Needs Follow-up", value: counts.needsFollowUp, icon: CircleAlert, note: "Threshold reached; staff review is needed" },
              { label: "Unknown", value: counts.unknown, icon: CircleHelp, note: "Missing or invalid attendance start date" },
            ].map(({ label, value, icon: Icon, note }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                    <Icon className="h-5 w-5 shrink-0 text-[#5D94E8]" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-[#203264]">{value.toLocaleString("en-PH")}</p>
                  <p className="mt-2 text-xs text-slate-500">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

      <TableToolbar className="lg:items-end [&>div]:w-full lg:[&>div]:flex-1">
        <FormField label="Search members" htmlFor="inactivity-search" className="md:col-span-2">
          <SearchInput id="inactivity-search" placeholder="Search by member name"
              value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
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
      </TableToolbar>

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
                        {canViewMemberStatus && <MemberStatus status={row.memberStatus} />}
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
          <Pagination label="Inactivity pagination" page={currentPage} pageSize={10} total={filtered.length} noun="members" onPageChange={setPage} />
        </>
      )}
      <p className="text-xs text-slate-500">
        Attendance flags use consecutive eligible absent weeks; the recent rate uses up to 8 eligible finished weeks and never change Member Status. Last attendance can include this week.
      </p>
    </section>
  );
}
