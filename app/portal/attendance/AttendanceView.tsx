"use client";

import {
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  serviceBranchId?: string;
  rows: AttendanceMemberRow[];
  summary: AttendanceSummary;
  canRecord: boolean;
  canCorrect: boolean;
};

type AttendanceFilter = "all" | AttendanceStatus | "absent";

const statusVariants: Record<
  AttendanceStatus | "absent",
  "success" | "warning" | "info" | "muted"
> = {
  present: "success",
  late: "warning",
  excused: "info",
  absent: "muted",
};

export default function AttendanceView({
  serviceId,
  serviceBranchId = "",
  rows,
  summary,
  canRecord,
  canCorrect,
}: AttendanceViewProps) {
  const router = useRouter();
  const [lookup, setLookup] = useState("");
  const [lookupRows, setLookupRows] = useState<AttendanceMemberRow[]>([]);
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
      const rowStatus = row.attendance?.status ?? "absent";
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
          label="Late"
          value={summary.late}
          icon={<Clock3 />}
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
          value={summary.absent}
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
            {canRecord && <FormField label="Find Visiting Member" htmlFor="attendance-lookup" description="Search member names church-wide (up to 30 matches). Only identity and home branch are shown.">
              <div className="flex gap-2">
                <Input id="attendance-lookup" type="search" value={lookup} onChange={event => setLookup(event.target.value)} placeholder="At least two characters" />
                <Button type="button" variant="outline" disabled={isPending || lookup.trim().length < 2} onClick={() => startTransition(async () => {
                  try {
                    const members = await searchAttendanceMembers(serviceId, lookup);
                    setLookupRows(members.map(member => ({ member, attendance: null, isCurrentlyEligible: true })));
                    setErrorMessage(members.length ? null : "No eligible members found.");
                  } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to search members."); }
                })}>Find Members</Button>
              </div>
            </FormField>}
            <div className="grid gap-5 md:grid-cols-3">
              <FormField
                label="Member"
                htmlFor="attendance-member"
                required
              >
                <Select
                  id="attendance-member"
                  name="member_id"
                  value={selectedMemberId}
                  onChange={(event) => {
                    const row = selectionRows.find(
                      (item) => item.member.id === event.target.value,
                    );

                    if (row) selectMember(row);
                  }}
                  disabled={isPending || recordableRows.length === 0}
                  required
                >
                  <option value="" disabled>
                    Select a member
                  </option>

                  {recordableRows.map((row) => (
                    <option key={row.member.id} value={row.member.id}>
                      {formatMemberName(row.member)}{row.member.memberStatus === "inactive" ? " · Inactive Member" : ""}{row.member.homeBranchName ? ` · ${row.member.homeBranchName}` : ""}{isVisitingMember(row.member.churchBranchId, serviceBranchId) ? " · Visiting Member" : ""}
                    </option>
                  ))}
                </Select>
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
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
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
                <TableHead><div className="flex items-center gap-1">Status<TableColumnFilter label="Attendance Status" value={statusFilter} onChange={(value) => setStatusFilter(value as AttendanceFilter)} options={[{ value: "all", label: "All statuses" }, { value: "present", label: "Present" }, { value: "late", label: "Late" }, { value: "excused", label: "Excused" }, { value: "absent", label: "No record (current roster)" }]} /></div></TableHead>
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
                const rowStatus = row.attendance?.status ?? "absent";

                return (
                  <TableRow key={row.member.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900">
                        {formatMemberName(row.member)}
                      </p>
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
