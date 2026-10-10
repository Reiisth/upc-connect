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

import { saveAttendanceRecord } from "./actions";
import {
  formatAttendanceStatus,
  formatMemberName,
  type AttendanceMemberRow,
  type AttendanceStatus,
  type AttendanceSummary,
} from "./types";

type AttendanceViewProps = {
  serviceId: string;
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
  rows,
  summary,
  canRecord,
  canCorrect,
}: AttendanceViewProps) {
  const router = useRouter();
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

  const recordableRows = useMemo(
    () => {
      if (canRecord && canCorrect) return rows;

      return canRecord
        ? rows.filter((row) => row.attendance === null)
        : rows.filter((row) => row.attendance !== null);
    },
    [canCorrect, canRecord, rows],
  );

  const canEdit = canRecord || canCorrect;

  function selectMember(row: AttendanceMemberRow) {
    setSelectedMemberId(row.member.id);
    setSelectedStatus(row.attendance?.status ?? "present");
    setCheckInTime(
      row.attendance?.checkInTime
        ? toLocalDateTimeValue(row.attendance.checkInTime)
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AttendanceSummaryCard
          label="Eligible Members"
          value={summary.totalEligible}
          icon={<Search />}
        />

        <AttendanceSummaryCard
          label="Present"
          value={summary.present}
          icon={<CheckCircle2 />}
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />

        <AttendanceSummaryCard
          label="Late"
          value={summary.late}
          icon={<Clock3 />}
          valueClassName="text-amber-700 dark:text-amber-400"
        />

        <AttendanceSummaryCard
          label="Excused"
          value={summary.excused}
          icon={<CheckCircle2 />}
          valueClassName="text-blue-700 dark:text-blue-400"
        />

        <AttendanceSummaryCard
          label="Absent (inferred)"
          value={summary.absent}
          icon={<SearchX />}
          valueClassName="text-slate-600 dark:text-slate-300"
        />
      </div>

      {canEdit ? (
        <FormSection
          title="Manual Attendance"
          description={
            canRecord && canCorrect
              ? "Record attendance for an active member or correct an existing record. Manual records use the current account as the recorder."
              : canRecord
                ? "Record attendance for an active member of this branch. New manual records use the current account as the recorder. Existing records require the attendance.correct permission."
                : "Correct existing attendance records. New records require the attendance.record permission."
          }
        >
          <form onSubmit={handleSubmit} className="space-y-5">
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
                    const row = rows.find(
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
                      {formatMemberName(row.member)}
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
                label="Check-in Time"
                htmlFor="attendance-check-in"
                description="Leave blank for excused attendance or to use the current time."
              >
                <Input
                  id="attendance-check-in"
                  name="check_in_time"
                  type="datetime-local"
                  value={checkInTime}
                  onChange={(event) => setCheckInTime(event.target.value)}
                  disabled={isPending}
                />
              </FormField>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              >
                {successMessage}
              </p>
            )}

            <FormActions>
              <span className="mr-auto text-sm text-slate-500 dark:text-slate-400">
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
        <p className="text-sm text-slate-500 dark:text-slate-400">
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

          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as AttendanceFilter)
            }
            className="lg:w-48"
            aria-label="Filter attendance by status"
          >
            <option value="all">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="excused">Excused</option>
            <option value="absent">Absent (inferred)</option>
          </Select>
        </div>

        {filteredRows.length === 0 ? (
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
                : "There are no active, non-archived members assigned to this service branch."
            }
          />
        ) : (
          <Table className="min-w-[1050px]">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in Time</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRows.map((row) => {
                const rowStatus = row.attendance?.status ?? "absent";

                return (
                  <TableRow key={row.member.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {formatMemberName(row.member)}
                      </p>
                    </TableCell>

                    <TableCell>
                      <StatusBadge variant={statusVariants[rowStatus]}>
                        {row.attendance
                          ? formatAttendanceStatus(row.attendance.status)
                          : "Absent (inferred)"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {row.attendance?.checkInTime
                        ? formatCheckInTime(row.attendance.checkInTime)
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
                      ) : !row.attendance && canRecord ? (
                        <TableActionButton
                          type="button"
                          onClick={() => selectMember(row)}
                          icon={<Plus />}
                        >
                          Record
                        </TableActionButton>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">
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
  valueClassName = "text-[#203264] dark:text-slate-100",
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
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>

            <p className={`mt-3 text-3xl font-semibold ${valueClassName}`}>
              {value}
            </p>
          </div>

          <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] dark:bg-slate-800 dark:text-slate-200 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCheckInTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
