"use client";

import {
  ExternalLink,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import MemberAutocomplete from "../contributions/MemberAutocomplete";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
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
import { TableColumnFilter } from "@/components/ui/table-column-filter";

import { saveAttendanceRecord, searchAttendanceMembers } from "./actions";
import { formatManilaTimestamp, toManilaDateTimeValue } from "@/lib/manila-time";
import {
  formatAttendanceStatus,
  isVisitingMember,
  formatMemberName,
  type AttendanceMemberRow,
  type AttendanceStatus,
  type AttendanceSummary,
} from "./types";

type AttendanceViewProps = {
  serviceId: string;
  visitingBranches?: { id: string; name: string }[];
  serviceBranchId?: string;
  rows: AttendanceMemberRow[];
  summary: AttendanceSummary;
  canRecord: boolean;
  canCorrect: boolean;
};

type AttendanceFilter = "all" | AttendanceStatus | "unrecorded";

const statusVariants: Record<
  AttendanceStatus | "unrecorded",
  "success" | "warning" | "info" | "muted"
> = {
  present: "success",
  unrecorded: "muted",
  excused: "info",
  absent: "muted",
};

export default function AttendanceView({
  serviceId,
  visitingBranches = [],
  serviceBranchId = "",
  rows,
  summary,
  canRecord,
  canCorrect,
}: AttendanceViewProps) {
  const router = useRouter();
  const [lookupBranch, setLookupBranch] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookup, setLookup] = useState("");
  const [lookupRows, setLookupRows] = useState<AttendanceMemberRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!canRecord || !lookupBranch || lookup.trim().length < 2 || !lookupOpen) return;
    const timer = setTimeout(async () => {
      setLookupBusy(true);
      try {
        const members = await searchAttendanceMembers(serviceId, lookup, lookupBranch);
        if (!cancelled) {
          setLookupRows(members.map(member => ({ member, attendance: null, isCurrentlyEligible: true })));
          setLookupMessage(members.length ? "" : "No eligible members found.");
        }
      } catch (error) {
        if (!cancelled) setLookupMessage(error instanceof Error ? error.message : "Unable to search members.");
      } finally { if (!cancelled) setLookupBusy(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [lookup, lookupBranch, serviceId, canRecord, lookupOpen]);
  const selectionRows = useMemo(() => [...rows, ...lookupRows.filter(found => !rows.some(row => row.member.id === found.member.id))], [rows, lookupRows]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AttendanceFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<AttendanceStatus>("present");
  const [checkInTime, setCheckInTime] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        formatMemberName(row.member)
          .toLowerCase()
          .includes(normalizedSearch);
      const rowStatus = row.attendance?.status ?? "unrecorded";
      const matchesStatus =
        statusFilter === "all" || rowStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);
  const hasClearableFilters = Boolean(search.trim() || statusFilter !== "all");
  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  const recordableRows = useMemo(
    () => {
      return selectionRows.filter((row) => row.attendance
        ? canCorrect : canRecord && row.isCurrentlyEligible);
    },
    [canCorrect, canRecord, selectionRows],
  );

  const canEdit = canRecord || canCorrect;

  function selectMember(row: AttendanceMemberRow) {
    setSelectedMemberId(row.member.id);
    setSelectedStatus(row.attendance?.status ?? "present");
    setCheckInTime(
      row.attendance?.checkInTime
        ? toManilaDateTimeValue(row.attendance.checkInTime)
        : "",
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMemberId) {
      setErrorMessage("Select a member before saving attendance.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        await saveAttendanceRecord(serviceId, formData);
        setSuccessMessage("Attendance was saved successfully.");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Attendance could not be saved.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AttendanceSummaryCard
          label="Currently Eligible Members"
          value={summary.totalEligible}
          icon={<Search />}
        />

        <AttendanceSummaryCard
          label="Present"
          value={summary.present}
          icon={<CheckCircle2 />}
          valueClassName="text-emerald-700"
        />

        <AttendanceSummaryCard
          label="Absent (Recorded)"
          value={summary.absent}
          icon={<SearchX />}
          valueClassName="text-amber-700"
        />

        <AttendanceSummaryCard
          label="Excused"
          value={summary.excused}
          icon={<CheckCircle2 />}
          valueClassName="text-blue-700"
        />

        <AttendanceSummaryCard
          label="No Record (Current Roster)"
          value={summary.unrecorded}
          icon={<SearchX />}
          valueClassName="text-slate-600"
        />
        <AttendanceSummaryCard label="Physical Check-ins" value={summary.totalCheckIns} icon={<CheckCircle2 />} />
      </div>

      {canEdit ? (
        <FormSection
          title="Manual Attendance"
          description={
            canRecord && canCorrect
              ? "Record attendance for a non-archived Active or Inactive member or correct an existing record. Manual records use the current account as the recorder."
              : canRecord
                ? "Record attendance for a non-archived Active or Inactive member from any home branch. New manual records use the current account as the recorder. Existing records require the attendance.correct permission."
                : "Correct existing attendance records. New records require the attendance.record permission."
          }
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="attendance_record_id"
              value={selectionRows.find((row) => row.member.id === selectedMemberId)?.attendance?.id ?? ""} />
            {canRecord && <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Visiting Member Branch" htmlFor="attendance-lookup-branch">
                <Select id="attendance-lookup-branch" value={lookupBranch} disabled={isPending} onChange={event => {
                  setLookupBranch(event.target.value); setLookup(""); setLookupRows([]); setLookupMessage(""); setLookupBusy(false); setLookupOpen(false); setSelectedMemberId("");
                }}>
                  <option value="">Select a branch</option>
                  {visitingBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Find Visiting Member" htmlFor="attendance-lookup" description="Select a branch, then type at least two characters to search.">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="attendance-lookup" type="search" className="pl-9" value={lookup} autoComplete="off" disabled={!lookupBranch || isPending}
                    onChange={event => { setLookup(event.target.value); setLookupRows([]); setLookupMessage(""); setLookupBusy(false); setLookupOpen(true); }}
                    onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); if (event.key === "Escape") setLookupOpen(false); }}
                    placeholder={lookupBranch ? "Search member name..." : "Select a branch first"} />
                  {lookupOpen && lookupBranch && lookup.trim().length >= 2 && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {lookupBusy && <p role="status" className="p-3 text-sm text-slate-500">Searching...</p>}
                    {!lookupBusy && lookupRows.map(row => <button key={row.member.id} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#EEF3FB] focus:bg-[#EEF3FB]" onClick={() => {
                      selectMember(selectionRows.find(item => item.member.id === row.member.id) ?? row); setLookup(formatMemberName(row.member)); setLookupOpen(false);
                    }}>{formatMemberName(row.member)}</button>)}
                    {!lookupBusy && lookupMessage && <p role="status" className="p-3 text-sm text-slate-500">{lookupMessage}</p>}
                  </div>}
                </div>
              </FormField>
            </div>}
            <div className="grid gap-5 md:grid-cols-3">
              <FormField
                label="Member"
                htmlFor="attendance-member"
                required
              >
                <fieldset disabled={isPending || recordableRows.length === 0}>
                  <MemberAutocomplete id="attendance-member" branchId={serviceBranchId}
                    members={recordableRows.map(row => ({ id: row.member.id, fullName: formatMemberName(row.member),
                      churchBranchId: row.member.churchBranchId, homeBranchName: row.member.homeBranchName ?? undefined, isArchived: row.member.isArchived }))}
                    value={selectedMemberId} onChange={memberId => {
                      const row = recordableRows.find(item => item.member.id === memberId);
                      if (row) selectMember(row); else setSelectedMemberId("");
                    }} />
                </fieldset>
              </FormField>

              <FormField
                label="Attendance Status"
                htmlFor="attendance-status"
                required
              >
                <Select
                  id="attendance-status"
                  name="attendance_status"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(
                      event.target.value as AttendanceStatus,
                    )
                  }
                  disabled={isPending}
                  required
                >
                  <option value="present">Present</option>
                  <option value="excused">Excused</option>
                  <option value="absent">Absent</option>
                </Select>
              </FormField>

              <FormField
                label="Check-in Time (Manila)"
                htmlFor="attendance-check-in"
                description="Leave blank for excused attendance or to use the current time."
              >
                <Input
                  id="attendance-check-in"
                  name="check_in_time"
                  type="datetime-local"
                  step="1"
                  value={checkInTime}
                  onChange={(event) => setCheckInTime(event.target.value)}
                  disabled={isPending}
                />
              </FormField>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
              >
                {successMessage}
              </p>
            )}

            <FormActions>
              <span className="mr-auto text-sm text-slate-500">
                Method: Manual
              </span>

              <Button
                type="submit"
                disabled={
                  isPending ||
                  !selectedMemberId ||
                  recordableRows.length === 0
                }
              >
                {isPending ? "Saving..." : "Save Attendance"}
              </Button>
            </FormActions>
          </form>
        </FormSection>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="View-only attendance access"
          description="Your account can review attendance for this service but cannot add or correct records."
        />
      )}

      {canCorrect && !canRecord && recordableRows.length === 0 && (
        <p className="text-sm text-slate-500">
          No existing attendance records are available for correction. An
          account with attendance.record must add the first record for a
          member.
        </p>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member name..."
              className="pl-9"
              aria-label="Search attendance members"
            />
          </div>
          {hasClearableFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title={
              search.trim() || statusFilter !== "all"
                ? "No matching members"
                : "No eligible members"
            }
            description={
              search.trim() || statusFilter !== "all"
                ? "No attendance rows match your current search or status filter."
                  : "No current eligible members or historical attendance records are available for this service."
            }
          />
        ) : (
          <Table className="min-w-[1050px]">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead><div className="flex items-center gap-1">Status<TableColumnFilter label="Attendance Status" value={statusFilter} onChange={(value) => setStatusFilter(value as AttendanceFilter)} options={[{ value: "all", label: "All statuses" }, { value: "present", label: "Present" }, { value: "excused", label: "Excused" }, { value: "absent", label: "Absent (recorded)" }, { value: "unrecorded", label: "No record (current roster)" }]} /></div></TableHead>
                <TableHead>Check-in Time</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={6}><p role="status" className="py-3 text-center text-sm text-slate-500">No attendance rows match the current filters.</p></TableCell></TableRow>
              ) : filteredRows.map((row) => {
                const rowStatus = row.attendance?.status ?? "unrecorded";

                return (
                  <TableRow key={row.member.id}>
                    <TableCell>
                      <Link href={`/portal/attendance/member/${row.member.id}`} className="inline-flex items-center gap-1.5 font-medium text-[#203264] hover:text-[#5D94E8] hover:underline">
                        {formatMemberName(row.member)}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </Link>
                      {isVisitingMember(row.member.churchBranchId, serviceBranchId) && <p className="text-xs text-slate-500">Visiting Member · {row.member.homeBranchName ?? "Home branch unknown"}</p>}
                      {row.member.memberStatus === "inactive" && <p className="text-xs text-slate-500">Inactive Member</p>}
                      {!row.isCurrentlyEligible && (row.member.isArchived || !["active", "inactive"].includes(row.member.memberStatus ?? "")) && <p className="text-xs text-slate-500">Historical attendee{row.member.isArchived ? " · Archived" : ""}</p>}
                    </TableCell>

                    <TableCell>
                      <StatusBadge variant={statusVariants[rowStatus]}>
                        {row.attendance
                          ? formatAttendanceStatus(row.attendance.status)
                          : "No record (current roster)"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {row.attendance?.checkInTime
                        ? formatManilaTimestamp(row.attendance.checkInTime)
                        : "—"}
                    </TableCell>

                    <TableCell>
                      {row.attendance?.method
                        ? formatAttendanceStatus(row.attendance.method)
                        : "—"}
                    </TableCell>

                    <TableCell>
                      {row.attendance?.recordedByName ??
                        (row.attendance?.recordedBy
                          ? "Staff account"
                          : "—")}
                    </TableCell>

                    <TableCell>
                      {row.attendance && canCorrect ? (
                        <TableActionButton
                          type="button"
                          onClick={() => selectMember(row)}
                          icon={<Pencil />}
                        >
                          Correct
                        </TableActionButton>
                      ) : !row.attendance && canRecord && row.isCurrentlyEligible ? (
                        <TableActionButton
                          type="button"
                          onClick={() => selectMember(row)}
                          icon={<Plus />}
                        >
                          Record
                        </TableActionButton>
                      ) : (
                        <span className="text-sm text-slate-400">
                          View only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function AttendanceSummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264]",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>

            <p className={`mt-3 text-3xl font-semibold ${valueClassName}`}>
              {value}
            </p>
          </div>

          <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
