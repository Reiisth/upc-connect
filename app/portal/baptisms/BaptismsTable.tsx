"use client";
import Link from "@/components/ui/intent-link";
import ModuleMiniDashboard, { type ModuleSummary } from "@/components/module-summary";

import {
  ExternalLink,
  Droplets,
  Flame,
  Pencil,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { refreshBaptismSummary } from "./dashboard-actions";
import { resolveAnalyticsDateRange, validAnalyticsDate } from "@/lib/analytics/date-range";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
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
  BAPTISM_TYPES,
  formatBaptismType,
  type BaptismBranch,
  type BaptismRecord,
  type BaptismType,
} from "./types";

type BaptismsTableProps = {
  dashboard?: ModuleSummary;
  records: BaptismRecord[];
  branches: BaptismBranch[];
  canUpdateWater: boolean;
  canUpdateHolyGhost: boolean;
};

const baptismTypeVariants: Record<
  BaptismType,
  "success" | "info"
> = {
  water: "info",
  holy_ghost: "success",
};

export default function BaptismsTable({
  dashboard,
  records,
  branches,
  canUpdateWater,
  canUpdateHolyGhost,
}: BaptismsTableProps) {
  const [page,setPage]=useState(1);
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(dashboard?.from??"");
  const [dateTo, setDateTo] = useState(dashboard?.to??"");
  const [range,setRange]=useState({from:dashboard?.from??"",to:dashboard?.to??"",includeUndated:!dashboard});
  const [summary,setSummary]=useState(dashboard);
  const [rangeError,setRangeError]=useState("");
  const [pending,startTransition]=useTransition();
  const [preset,setPreset]=useState("recent");
  function applyRange(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setRangeError("");
    if(!validAnalyticsDate(dateFrom)||!validAnalyticsDate(dateTo)||dateFrom>dateTo){setRangeError("Choose a valid start and end date, with From on or before To.");return;}
    startTransition(async()=>{try{
      const next=await refreshBaptismSummary(dateFrom,dateTo);
      setSummary(next);setRange({from:dateFrom,to:dateTo,includeUndated:preset==="all"});setPage(1);
    }catch{setRangeError("Unable to apply date range. Try again.");}});
  }
  function choosePreset(value:string){
    setPreset(value);setRangeError("");
    const today=dashboard?.to??new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
    if(value==="recent"){setDateFrom(dashboard?.from??`${today.slice(0,7)}-01`);setDateTo(today);}
    else if(value==="month"){setDateFrom(`${today.slice(0,7)}-01`);setDateTo(today);}
    else if(value==="all"){const dates=records.flatMap(record=>record.baptismDate?[record.baptismDate]:[]).sort(),last=dates[dates.length-1]??today;setDateFrom(dates[0]??today);setDateTo(last>today?last:today);}
    else if(value!=="custom"){const next=resolveAnalyticsDateRange({preset:value as "last_30_days"|"year_to_date"},today);setDateFrom(next.from);setDateTo(next.to);}
  }

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const matchesSearch =
          !normalizedSearch ||
          record.memberName.toLowerCase().includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          record.churchBranchId === branchFilter;
        const matchesType =
          typeFilter === "all" ||
          record.baptismType === typeFilter;
        const matchesDateFrom =
          !range.from || (record.baptismDate===null ? range.includeUndated : record.baptismDate >= range.from);
        const matchesDateTo =
          !range.to || (record.baptismDate===null ? range.includeUndated : record.baptismDate <= range.to);

        return (
          matchesSearch &&
          matchesBranch &&
          matchesType &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort((a, b) => {
        if (sortBy === "name_asc" || sortBy === "name_desc") return (sortBy === "name_desc" ? -1 : 1) * a.memberName.localeCompare(b.memberName) || a.id.localeCompare(b.id);
        if (!a.baptismDate || !b.baptismDate) return compareBaptisms(a, b) || a.id.localeCompare(b.id);
        return (sortBy === "oldest" ? -1 : 1) * compareBaptisms(a, b) || a.id.localeCompare(b.id);
      });
  }, [records, search, branchFilter, typeFilter, range, sortBy]);

  const pageSize=10,totalPages=Math.max(1,Math.ceil(filteredRecords.length/pageSize));
  const currentPage=Math.min(page,totalPages);
  const pageRecords=filteredRecords.slice((currentPage-1)*pageSize,currentPage*pageSize);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";
  const hasClearableFilters = search.trim() !== "" || branchFilter !== "all" || typeFilter !== "all";

  function clearFilters() {
    setPage(1);
    setSearch("");
    setBranchFilter("all");
    setTypeFilter("all");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applyRange} noValidate aria-label="Baptism date range">
        <fieldset aria-labelledby="baptism-range-title" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <h2 id="baptism-range-title" className="mb-3 text-sm font-semibold text-[#203264]">Date range</h2>
          <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]">
            <FormField label="Period" htmlFor="baptism-period" className="col-span-2 lg:col-span-1"><Select id="baptism-period" value={preset} onChange={e=>choosePreset(e.target.value)}><option value="recent">Recent 12 months</option><option value="month">This month</option><option value="last_30_days">Last 30 days</option><option value="year_to_date">Year to date</option><option value="all">All time</option><option value="custom">Custom range</option></Select></FormField>
            <FormField label="From" htmlFor="baptisms-from"><Input id="baptisms-from" type="date" value={dateFrom} max={dateTo||undefined} onChange={(event)=>{setDateFrom(event.target.value);setPreset("custom");}} aria-label="Baptisms from date" aria-invalid={Boolean(rangeError)||undefined}/></FormField>
            <FormField label="To" htmlFor="baptisms-to"><Input id="baptisms-to" type="date" value={dateTo} min={dateFrom||undefined} onChange={(event)=>{setDateTo(event.target.value);setPreset("custom");}} aria-label="Baptisms to date" aria-invalid={Boolean(rangeError)||undefined}/></FormField>
            <Button type="submit" className="col-span-2 lg:col-span-1" loading={pending} disabled={pending}>{pending?"Applying...":"Apply range"}</Button>
          </div>
          {rangeError&&<p role="alert" className="mt-2 text-sm text-red-700">{rangeError}</p>}
        </fieldset>
      </form>
      {summary && <ModuleMiniDashboard data={summary} branchId={branchFilter} branchName={branchFilter === "all" ? "All accessible branches" : branches.find(b => b.id === branchFilter)?.name ?? "Selected branch"} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => {setSearch(event.target.value);setPage(1);}}
            placeholder="Search by member name..."
            className="pl-9"
            aria-label="Search baptism records by member name"
          />
        </div>

        <div className="w-full shrink-0 sm:w-56">
          <Select
            value={branchFilter}
            onChange={(event) => {setBranchFilter(event.target.value);setPage(1);}}
            aria-label="Filter baptisms by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>


        </div>

        <Select aria-label="Sort baptisms" value={sortBy} onChange={event => { setSortBy(event.target.value); setPage(1); }} className="w-full sm:w-52"><option value="newest">Date: newest first</option><option value="oldest">Date: oldest first</option><option value="name_asc">Name: A-Z</option><option value="name_desc">Name: Z-A</option></Select>
        {hasClearableFilters && <ClearFiltersButton onClick={clearFilters} className="self-start sm:self-center" />}
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={
            hasFilters
              ? "No matching baptism records"
              : "No baptism records found"
          }
          description={
            hasFilters
              ? "No records match your current search or filters. Try adjusting them."
              : "Create a baptism record to begin building the ministry history."
          }
        />
      ) : (
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead><div className="flex items-center gap-1">Baptism Type<TableColumnFilter label="Baptism Type" value={typeFilter} onChange={value=>{setTypeFilter(value);setPage(1);}} options={[{ value: "all", label: "All baptism types" }, ...BAPTISM_TYPES.map((type) => ({ value: type, label: formatBaptismType(type) }))]} /></div></TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Officiated By</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={7}><p role="status" className="py-3 text-center text-sm text-slate-500">No baptism records match the current filters.</p></TableCell></TableRow>
            ) : pageRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-xl p-2 ${record.baptismType==="water"?"bg-sky-50 text-sky-600":"bg-amber-50 text-amber-600"}`}>
                      {record.baptismType==="water"?<Droplets className="h-4 w-4" />:<Flame className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0">
                      <Link href={`/portal/baptisms/member/${record.memberId}?returnTo=/portal/baptisms`} className="inline-flex items-center gap-1.5 font-medium text-[#203264] hover:text-[#5D94E8] hover:underline">{record.memberName}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></Link>

                      <p className="mt-1 text-xs text-slate-500">{formatBaptismDate(record.baptismDate)}</p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge
                    variant={baptismTypeVariants[record.baptismType]}
                  >
                    {formatBaptismType(record.baptismType)}
                  </StatusBadge>
                </TableCell>

                <TableCell>
                  {record.branch ? (
                    <div>
                      <p className="font-medium text-slate-800">
                        {record.branch.name}
                      </p>

                      {record.branch.code && (
                        <p className="mt-1 text-xs text-slate-500">
                          {record.branch.code}
                        </p>
                      )}
                    </div>
                  ) : (
                    <StatusBadge variant="muted">
                      Unknown branch
                    </StatusBadge>
                  )}
                </TableCell>

                <TableCell>
                  {record.officiatedBy ?? "—"}
                </TableCell>

                <TableCell>{record.location ?? "—"}</TableCell>

                <TableCell>
                  {record.recordedByName ??
                    (record.recordedBy ? "Staff account" : "—")}
                </TableCell>

                <TableCell>
                  {(record.baptismType === "water"
                    ? canUpdateWater
                    : canUpdateHolyGhost) ? (
                    <TableActionButton
                      href={`/portal/baptisms/${record.id}/edit`}
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
      {filteredRecords.length>0&&<nav aria-label="Baptisms pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-slate-500">Showing {(currentPage-1)*pageSize+1}-{Math.min(currentPage*pageSize,filteredRecords.length)} of {filteredRecords.length} baptism records</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</Button>
          <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={currentPage===totalPages} onClick={()=>setPage(currentPage+1)}>Next</Button>
        </div>
      </nav>}
    </div>
  );
}

function compareBaptisms(
  first: BaptismRecord,
  second: BaptismRecord,
) {
  if (!first.baptismDate && !second.baptismDate) return 0;
  if (!first.baptismDate) return 1;
  if (!second.baptismDate) return -1;

  return second.baptismDate.localeCompare(first.baptismDate);
}

function formatBaptismDate(value: string | null) {
  if (!value) return "Date unknown";

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "Date unknown";

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}
