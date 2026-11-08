"use client";
import Link from "next/link";
import ServiceLifecycleActions from "./ServiceLifecycleActions";
import ServiceStatusIcon from "./ServiceStatusIcon";

import { serviceTimestamp } from "@/lib/manila-time";

import {
  ExternalLink,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableColumnFilter } from "@/components/ui/table-column-filter";

import {
  formatServiceStatus,
  formatServiceType,
  SERVICE_STATUSES,
  type ServiceTypeOption,
  type ServiceBranch,
  type ServiceRecord,
} from "./types";

type ServicesTableProps = {
  services: ServiceRecord[];
  serviceTypes: ServiceTypeOption[];
  serviceTypeNames: Record<string, string>;
  branches: ServiceBranch[];
  canEdit: boolean;
  canManageAttendance: boolean;
};

export default function ServicesTable({
  services,
  serviceTypes,
  serviceTypeNames,
  branches,
  canEdit,
}: ServicesTableProps) {
  const [page, setPage] = useState(1);
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

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedServices = filteredServices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setPage(1);
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
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search by service name..."
            className="pl-9"
            aria-label="Search services"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
          <Select
            value={branchFilter}
            onChange={(event) => { setBranchFilter(event.target.value); setPage(1); }}
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

          {hasFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>
      </div>

      {services.length === 0 ? (
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
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead><div className="flex items-center gap-1">Service<TableColumnFilter label="Service Status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...SERVICE_STATUSES.map((status) => ({ value: status, label: formatServiceStatus(status) }))]} /></div></TableHead>
              <TableHead><div className="flex items-center gap-1">Type<TableColumnFilter label="Service Type" value={typeFilter} onChange={(value) => { setTypeFilter(value); setPage(1); }} options={[{ value: "all", label: "All types" }, ...serviceTypes.map((type) => ({ value: type.key, label: type.name }))]} /></div></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredServices.length === 0 ? (
              <TableRow><TableCell colSpan={2}><p role="status" className="py-3 text-center text-sm text-slate-500">No services match the current filters.</p></TableCell></TableRow>
            ) : paginatedServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">{canEdit && (service.status === "ongoing" || service.status === "scheduled") ? <ServiceLifecycleActions id={service.id} status={service.status} iconOnly /> : <ServiceStatusIcon status={service.status} />}</div>
                    <div className="min-w-0">
                      <Link href={`/portal/services/${service.id}`} className="inline-flex items-center gap-1.5 font-medium text-[#203264] hover:text-[#5D94E8] hover:underline">{service.name}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></Link>

                      <p className="mt-1 text-xs text-slate-500">{service.branch?.name ?? "Unknown branch"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatServiceDate(service.serviceDate)} · {formatStartTime(service.startTime)}</p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {formatServiceType(service.serviceType, serviceTypeNames)}
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {filteredServices.length > 0 && (
        <nav aria-label="Services pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="text-sm text-slate-500">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredServices.length)} of {filteredServices.length} services</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
            <Button type="button" variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </nav>
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
