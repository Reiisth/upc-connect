"use client";
import { Card, CardContent } from "@/components/ui/card";

import { Pagination } from "@/components/ui/pagination";

import { SearchInput, TableToolbar } from "@/components/ui/table-toolbar";

import Link from "next/link";
import ServiceLifecycleActions from "./ServiceLifecycleActions";
import ServiceStatusIcon from "./ServiceStatusIcon";

import { serviceTimestamp } from "@/lib/manila-time";

import { CalendarDays, CheckCircle2, Clock3, ExternalLink, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";


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
  const [sortBy, setSortBy] = useState("schedule");
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
      .sort((a, b) => {
        if (sortBy === "name_asc" || sortBy === "name_desc") return (sortBy === "name_desc" ? -1 : 1) * a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
        if (sortBy === "schedule") return compareServices(a, b) || a.id.localeCompare(b.id);
        return (sortBy === "oldest" ? 1 : -1) * (getServiceTimestamp(a) - getServiceTimestamp(b)) || a.id.localeCompare(b.id);
      });
  }, [services, search, branchFilter, typeFilter, statusFilter, sortBy]);

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
      <div className="grid gap-4 sm:grid-cols-3">
        <ServiceSummaryCard
          label="Visible Services"
          value={filteredServices.length}
          icon={<CalendarDays />}
        />

        <ServiceSummaryCard
          label="Scheduled"
          value={filteredServices.filter(service => service.status === "scheduled").length}
          icon={<Clock3 />}
          valueClassName="text-amber-700"
        />

        <ServiceSummaryCard
          label="Ongoing"
          value={filteredServices.filter(service => service.status === "ongoing").length}
          icon={<CheckCircle2 />}
          valueClassName="text-emerald-700"
        />
      </div>


      <TableToolbar>
        <SearchInput
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search by service name..."
            aria-label="Search services"
          />

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

          <Select aria-label="Sort services" value={sortBy} onChange={event => { setSortBy(event.target.value); setPage(1); }} className="w-full sm:w-52"><option value="schedule">Schedule order</option><option value="newest">Date: newest first</option><option value="oldest">Date: oldest first</option><option value="name_asc">Name: A-Z</option><option value="name_desc">Name: Z-A</option></Select>
        {hasFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>
      </TableToolbar>

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
        <Pagination label="Services pagination" page={currentPage} pageSize={10} total={filteredServices.length} noun="services" onPageChange={setPage} />
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

function ServiceSummaryCard({
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
