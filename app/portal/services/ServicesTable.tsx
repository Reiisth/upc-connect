"use client";

import {
  CalendarClock,
  Pencil,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
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

import {
  formatServiceStatus,
  formatServiceType,
  SERVICE_STATUSES,
  SERVICE_TYPES,
  type ServiceBranch,
  type ServiceRecord,
  type ServiceStatus,
} from "./types";

type ServicesTableProps = {
  services: ServiceRecord[];
  branches: ServiceBranch[];
  canEdit: boolean;
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

export default function ServicesTable({
  services,
  branches,
  canEdit,
}: ServicesTableProps) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
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

        const matchesType =
          typeFilter === "all" ||
          service.serviceType === typeFilter;

        const matchesStatus =
          statusFilter === "all" ||
          service.status === statusFilter;

        return (
          Boolean(matchesSearch) &&
          matchesBranch &&
          matchesType &&
          matchesStatus
        );
      })
      .sort(compareServices);
  }, [services, search, branchFilter, typeFilter, statusFilter]);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by service name..."
            className="pl-9"
            aria-label="Search services"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
          <Select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="lg:w-48"
            aria-label="Filter by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>

          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="lg:w-48"
            aria-label="Filter by service type"
          >
            <option value="all">All types</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatServiceType(type)}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="lg:w-44"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {SERVICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatServiceStatus(status)}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-[#203264] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filteredServices.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={
            hasFilters
              ? "No matching services"
              : "No services found"
          }
          description={
            hasFilters
              ? "No services match your current search or filters. Try adjusting them."
              : "Create a service to begin organizing branch schedules."
          }
        />
      ) : (
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-[#EEF3FB] p-2 text-[#203264]">
                      <CalendarClock className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {service.name}
                      </p>

                      {service.notes && (
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {service.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {formatServiceType(service.serviceType)}
                </TableCell>

                <TableCell>
                  {service.branch ? (
                    <div>
                      <p className="font-medium text-slate-800">
                        {service.branch.name}
                      </p>

                      {service.branch.code && (
                        <p className="mt-1 text-xs text-slate-500">
                          {service.branch.code}
                        </p>
                      )}
                    </div>
                  ) : (
                    <StatusBadge variant="muted">
                      Unknown branch
                    </StatusBadge>
                  )}
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {formatServiceDate(service.serviceDate)}
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {formatStartTime(service.startTime)}
                </TableCell>

                <TableCell>
                  <StatusBadge
                    variant={statusVariants[service.status]}
                  >
                    {formatServiceStatus(service.status)}
                  </StatusBadge>
                </TableCell>

                <TableCell>
                  {canEdit ? (
                    <TableActionButton
                      href={`/portal/services/${service.id}/edit`}
                      icon={<Pencil />}
                    >
                      Edit
                    </TableActionButton>
                  ) : (
                    <span className="text-sm text-slate-400">
                      View only
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function compareServices(
  first: ServiceRecord,
  second: ServiceRecord,
) {
  const firstTime = getServiceTimestamp(first);
  const secondTime = getServiceTimestamp(second);
  const now = Date.now();
  const firstIsUpcoming = firstTime >= now;
  const secondIsUpcoming = secondTime >= now;

  if (firstIsUpcoming !== secondIsUpcoming) {
    return firstIsUpcoming ? -1 : 1;
  }

  return firstIsUpcoming
    ? firstTime - secondTime
    : secondTime - firstTime;
}

function getServiceTimestamp(service: ServiceRecord) {
  const time = service.startTime || "23:59";
  const timestamp = new Date(
    `${service.serviceDate}T${time}`,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
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
