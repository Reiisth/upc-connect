"use client";
import AttendanceMiniDashboard from "./AttendanceMiniDashboard";
import type { AttendanceDashboardData } from "@/lib/attendance-dashboard-model";

import { serviceTimestamp } from "@/lib/manila-time";

import {
  ClipboardCheck,
  Pencil,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
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

import {
  formatServiceStatus,
  formatServiceType,
  type ServiceTypeOption,
  type ServiceBranch,
  type ServiceRecord,
  type ServiceStatus,
} from "../services/types";

type AttendanceServicesTableProps = {
  dashboard?: AttendanceDashboardData;
  canEditServices?: boolean;
  services: ServiceRecord[];
  branches: ServiceBranch[];
  serviceTypes: ServiceTypeOption[];
  serviceTypeNames: Record<string, string>;
};

const statusVariants: Record<
  ServiceStatus,
  "success" | "warning" | "danger" | "muted"
> = {
  scheduled: "warning",
  ongoing: "success",
  completed: "muted",
  cancelled: "danger",
};

export default function AttendanceServicesTable({
  dashboard,
  canEditServices = false,
  services,
  branches,
  serviceTypes,
  serviceTypeNames,
}: AttendanceServicesTableProps) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...services]
      .filter((service) => {
        const matchesSearch =
          !normalizedSearch ||
          service.name.toLowerCase().includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          service.churchBranchId === branchFilter;
        const matchesDate =
          !dateFilter || service.serviceDate === dateFilter;
        const matchesType =
          typeFilter === "all" || service.serviceType === typeFilter;
        const matchesStatus =
          statusFilter === "all" || service.status === statusFilter;

        return (
          Boolean(matchesSearch) &&
          matchesBranch &&
          matchesDate &&
          matchesType &&
          matchesStatus
        );
      })
      .sort(compareServices);
  }, [
    services,
    search,
    branchFilter,
    dateFilter,
    typeFilter,
    statusFilter,
  ]);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    dateFilter !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
    setDateFilter("");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-4">
      {dashboard && <AttendanceMiniDashboard initial={dashboard} branches={branches} branchFilter={branchFilter} onBranchChange={setBranchFilter} />}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by service name..."
            className="pl-9"
            aria-label="Search attendance services"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex">
          {!dashboard && <Select aria-label="Filter attendance by branch" value={branchFilter} onChange={event=>setBranchFilter(event.target.value)}><option value="all">All branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>}
          <Input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="xl:w-40"
            aria-label="Filter attendance by service date"
            title="Operational Service date only; independent of Dashboard Date"
          />

          {hasFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>
      </div>

      {(["ongoing","scheduled"] as const).map(group => <section key={group} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><h2 className={`text-lg font-semibold ${group === "ongoing" ? "text-[#203264]" : "text-slate-600"}`}>{group === "ongoing" ? "Ongoing Services" : "Upcoming Services"}</h2><StatusBadge variant={group === "ongoing" ? "success" : "muted"}>{group === "ongoing" ? "Attendance Open" : "Preparation Only"}</StatusBadge></div>
        {!services.some(service => service.status === group) ? <EmptyState icon={<SearchX className="h-5 w-5" />} title={group === "ongoing" ? "No services are currently ongoing." : "No upcoming services."} description="No Services match this section and the current filters." /> : (
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead><div className="flex items-center gap-1">Type<TableColumnFilter label="Service Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: "all", label: "All types" }, ...serviceTypes.map((type) => ({ value: type.key, label: type.name }))]} /></div></TableHead>
              <TableHead><div className="flex items-center gap-1">Status<TableColumnFilter label="Service Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...["ongoing","scheduled"].map((status) => ({ value: status, label: formatServiceStatus(status) }))]} /></div></TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredServices.filter(service => service.status === group).length === 0 ? (
              <TableRow><TableCell colSpan={4}><p role="status" className="py-3 text-center text-sm text-slate-500">No services match the current filters.</p></TableCell></TableRow>
            ) : filteredServices.filter(service => service.status === group).map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#EEF3FB] p-2 text-[#203264]">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {service.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">{service.branch?.name ?? "Unknown branch"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatServiceDate(service.serviceDate)} · {formatStartTime(service.startTime)}</p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {formatServiceType(service.serviceType, serviceTypeNames)}
                </TableCell>

                <TableCell>
                  <StatusBadge
                    variant={statusVariants[service.status]}
                  >
                    {formatServiceStatus(service.status)}
                  </StatusBadge>
                </TableCell>

                <TableCell>
                  <TableActionButton
                    href={`/portal/attendance/${service.id}`}
                    icon={<ClipboardCheck />}
                  >
                    {service.status === "ongoing" ? "Open Attendance" : "View Service"}
                  </TableActionButton>
                  {service.status === "scheduled" && canEditServices && <TableActionButton href={`/portal/services/${service.id}/edit`} icon={<Pencil />}>Edit Service</TableActionButton>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}</section>)}
    </div>
  );
}

function compareServices(
  first: ServiceRecord,
  second: ServiceRecord,
) {
  const firstTime = getServiceTimestamp(first);
  const secondTime = getServiceTimestamp(second);
  const firstIsUpcoming = first.status === "scheduled";
  const secondIsUpcoming = second.status === "scheduled";

  if (firstIsUpcoming !== secondIsUpcoming) {
    return firstIsUpcoming ? -1 : 1;
  }

  return firstIsUpcoming
    ? firstTime - secondTime
    : secondTime - firstTime;
}

function getServiceTimestamp(service: ServiceRecord) {
  return serviceTimestamp(service.serviceDate, service.startTime);
}

function formatServiceDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "—";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

function formatStartTime(value: string | null) {
  if (!value) return "—";

  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(
    "en-PH",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );
}
