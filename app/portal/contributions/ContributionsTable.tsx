"use client";
import ModuleMiniDashboard, { type ModuleSummary } from "@/components/module-summary";

import {
  Pencil,
  Search,
  SearchX,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { refreshContributionSummary } from "./dashboard-actions";
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
  CONTRIBUTION_TYPES,
  contributorName,
  formatContributionAmount,
  formatContributionType,
  formatPaymentMethod,
  PAYMENT_METHODS,
  type ContributionBranch,
  type ContributionRecord,
} from "./types";

type ContributionsTableProps = {
  dashboard?: ModuleSummary;
  records: ContributionRecord[];
  branches: ContributionBranch[];
  canUpdate: boolean;
};

const contributionTypeVariants: Record<
  ContributionRecord["contributionType"],
  "success" | "info" | "muted"
> = {
  tithe: "success",
  love_offering: "info",
  other: "muted",
};

export default function ContributionsTable({
  dashboard,
  records,
  branches,
  canUpdate,
}: ContributionsTableProps) {
  const [page,setPage]=useState(1);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(dashboard?.from??"");
  const [dateTo, setDateTo] = useState(dashboard?.to??"");
  const [range,setRange]=useState({from:dashboard?.from??"",to:dashboard?.to??""});
  const [summary,setSummary]=useState(dashboard);
  const [rangeError,setRangeError]=useState("");
  const [pending,startTransition]=useTransition();
  const [preset,setPreset]=useState("recent");
  function applyRange(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setRangeError("");
    if(!validAnalyticsDate(dateFrom)||!validAnalyticsDate(dateTo)||dateFrom>dateTo){setRangeError("Choose a valid start and end date, with From on or before To.");return;}
    startTransition(async()=>{try{
      const next=await refreshContributionSummary(dateFrom,dateTo);
      setSummary(next);setRange({from:dateFrom,to:dateTo});setPage(1);
    }catch{setRangeError("Unable to apply date range. Try again.");}});
  }
  function choosePreset(value:string){
    setPreset(value);setRangeError("");
    const today=dashboard?.to??new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
    if(value==="recent"){setDateFrom(dashboard?.from??`${today.slice(0,7)}-01`);setDateTo(today);}
    else if(value==="month"){setDateFrom(`${today.slice(0,7)}-01`);setDateTo(today);}
    else if(value==="all"){const dates=records.map(record=>record.contributionDate).sort(),last=dates[dates.length-1]??today;setDateFrom(dates[0]??today);setDateTo(last>today?last:today);}
    else if(value!=="custom"){const next=resolveAnalyticsDateRange({preset:value as "last_30_days"|"year_to_date"},today);setDateFrom(next.from);setDateTo(next.to);}
  }

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const name = contributorName(record);
        const matchesSearch =
          !normalizedSearch ||
          name.toLowerCase().includes(normalizedSearch);
        const matchesBranch =
          branchFilter === "all" ||
          record.churchBranchId === branchFilter;
        const matchesType =
          typeFilter === "all" ||
          record.contributionType === typeFilter;
        const matchesPayment =
          paymentFilter === "all" ||
          record.paymentMethod === paymentFilter;
        const matchesDateFrom =
          !range.from || record.contributionDate >= range.from;
        const matchesDateTo =
          !range.to || record.contributionDate <= range.to;

        return (
          matchesSearch &&
          matchesBranch &&
          matchesType &&
          matchesPayment &&
          matchesDateFrom &&
          matchesDateTo
        );
      })
      .sort(compareContributions);
  }, [
    records,
    search,
    branchFilter,
    typeFilter,
    paymentFilter,
    range,
  ]);

  const pageSize=10;
  const totalPages=Math.max(1,Math.ceil(filteredRecords.length/pageSize));
  const currentPage=Math.min(page,totalPages);
  const pageRecords=filteredRecords.slice((currentPage-1)*pageSize,currentPage*pageSize);

  const hasFilters =
    search.trim() !== "" ||
    branchFilter !== "all" ||
    typeFilter !== "all" ||
    paymentFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";
  const hasClearableFilters = search.trim() !== "" || branchFilter !== "all" || typeFilter !== "all" || paymentFilter !== "all";

  function clearFilters() {
    setPage(1);
    setSearch("");
    setBranchFilter("all");
    setTypeFilter("all");
    setPaymentFilter("all");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applyRange} noValidate aria-label="Contribution date range">
        <fieldset aria-labelledby="contribution-range-title" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <h2 id="contribution-range-title" className="mb-3 text-sm font-semibold text-[#203264]">Date range</h2>
          <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]">
            <FormField label="Period" htmlFor="contribution-period" className="col-span-2 lg:col-span-1"><Select id="contribution-period" value={preset} onChange={e=>choosePreset(e.target.value)}><option value="recent">Recent 6 months</option><option value="month">This month</option><option value="last_30_days">Last 30 days</option><option value="year_to_date">Year to date</option><option value="all">All time</option><option value="custom">Custom range</option></Select></FormField>
            <FormField label="From" htmlFor="contributions-from"><Input id="contributions-from" type="date" value={dateFrom} max={dateTo||undefined} onChange={(event)=>{setDateFrom(event.target.value);setPreset("custom");}} aria-label="Contributions from date" aria-invalid={Boolean(rangeError)||undefined}/></FormField>
            <FormField label="To" htmlFor="contributions-to"><Input id="contributions-to" type="date" value={dateTo} min={dateFrom||undefined} onChange={(event)=>{setDateTo(event.target.value);setPreset("custom");}} aria-label="Contributions to date" aria-invalid={Boolean(rangeError)||undefined}/></FormField>
            <Button type="submit" className="col-span-2 lg:col-span-1" disabled={pending}>{pending?"Applying...":"Apply range"}</Button>
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
            placeholder="Search by contributor name..."
            className="pl-9"
            aria-label="Search contributions by contributor name"
          />
        </div>

        <div className="w-full shrink-0 sm:w-56">
          <Select
            value={branchFilter}
            onChange={(event) => {setBranchFilter(event.target.value);setPage(1);}}
            aria-label="Filter contributions by branch"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>


        </div>

        {hasClearableFilters && <ClearFiltersButton onClick={clearFilters} className="self-start sm:self-center" />}
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={hasFilters ? "No matching contributions" : "No contributions found"}
          description={
            hasFilters
              ? "No contributions match your current search or filters. Try adjusting them."
              : "Record a contribution to begin building the branch financial history."
          }
        />
      ) : (
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead><div className="flex items-center gap-1">Type<TableColumnFilter label="Contribution Type" value={typeFilter} onChange={value=>{setTypeFilter(value);setPage(1);}} options={[{ value: "all", label: "All types" }, ...CONTRIBUTION_TYPES.map((type) => ({ value: type, label: formatContributionType(type) }))]} /></div></TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Service</TableHead>
              <TableHead><div className="flex items-center gap-1">Payment Method<TableColumnFilter label="Payment Method" value={paymentFilter} onChange={value=>{setPaymentFilter(value);setPage(1);}} options={[{ value: "all", label: "All payment methods" }, ...PAYMENT_METHODS.map((method) => ({ value: method, label: formatPaymentMethod(method) }))]} /></div></TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={9}><p role="status" className="py-3 text-center text-sm text-slate-500">No contributions match the current filters.</p></TableCell></TableRow>
            ) : pageRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="whitespace-nowrap">
                  {formatContributionDate(record.contributionDate)}
                </TableCell>

                <TableCell>
                  <div className="flex items-start gap-3">

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {contributorName(record)}
                      </p>

                      <p className="text-xs text-slate-500">{formatContributionType(record.contributorType)}{record.contributorType === "member" && record.memberHomeBranchName ? ` · ${record.memberHomeBranchName}` : ""}</p>
                      {record.notes && (
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge
                    variant={
                      contributionTypeVariants[
                        record.contributionType
                      ]
                    }
                  >
                    {formatContributionType(record.contributionType)}
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
                  {record.serviceName ?? "—"}
                </TableCell>

                <TableCell>
                  {formatPaymentMethod(record.paymentMethod)}
                </TableCell>

                <TableCell className="whitespace-nowrap font-semibold text-slate-900">
                  {formatAmount(record.amount)}
                </TableCell>

                <TableCell>
                  {record.recordedByName ??
                    (record.recordedBy ? "Staff account" : "—")}
                </TableCell>

                <TableCell>
                  {canUpdate ? (
                    <TableActionButton
                      href={`/portal/contributions/${record.id}/edit`}
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
      {filteredRecords.length>0&&<nav aria-label="Contributions pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-slate-500">Showing {(currentPage-1)*pageSize+1}-{Math.min(currentPage*pageSize,filteredRecords.length)} of {filteredRecords.length} contributions</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</Button>
          <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={currentPage===totalPages} onClick={()=>setPage(currentPage+1)}>Next</Button>
        </div>
      </nav>}
    </div>
  );
}

function compareContributions(
  first: ContributionRecord,
  second: ContributionRecord,
) {
  return second.contributionDate.localeCompare(
    first.contributionDate,
  );
}

export function formatAmount(value: string | number) {
  return formatContributionAmount(value);
}

function formatContributionDate(value: string) {
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
