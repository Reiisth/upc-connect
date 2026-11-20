"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AnalyticsBranch } from "@/lib/analytics/types";
import { REPORT_PRESETS, type ReportFilterValues } from "./filters";
import { formatReportDate } from "./presentation";

export default function ReportFilters({ branches, values, onFiltersChange, context, action = "/portal/reports" }: {
  branches: readonly AnalyticsBranch[]; values: ReportFilterValues; onFiltersChange?: () => void; action?: string; context?: ReactNode;
}) {
  const [preset, setPreset] = useState(values.preset);
  const form = <form action={action} method="get" onChange={onFiltersChange} onSubmit={onFiltersChange}
      className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Dashboard filters">
      <FormField label="Date Range" htmlFor="report-range">
        <Select id="report-range" name="range" value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}>
          {REPORT_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </FormField>
      <FormField label="Group Trends By" htmlFor="report-grouping">
        <Select id="report-grouping" name="grouping" defaultValue={values.grouping}>
          <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
        </Select>
      </FormField>
      <Button type="submit" disabled={!branches.length} className="w-full"><Filter className="h-4 w-4" />Apply filters</Button>
      <div className={preset === "custom" ? "grid gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-span-3" : "hidden"}>
        <FormField label="From" htmlFor="report-from">
          <Input id="report-from" name="from" type="date" min="0001-01-01" defaultValue={values.from} required={preset === "custom"} disabled={preset !== "custom"} />
        </FormField>
        <FormField label="To" htmlFor="report-to">
          <Input id="report-to" name="to" type="date" min="0001-01-01" defaultValue={values.to} required={preset === "custom"} disabled={preset !== "custom"} />
        </FormField>
      </div>
    </form>;
  if (context) {
    const dateLabel = REPORT_PRESETS.find(item => item.value === values.preset)?.label ?? "Date range";
    return <Card className="portal-branch-glow border-[#E5EEFC]"><CardContent className="grid min-w-0 items-start gap-3 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">{context}</div>
      <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-end">
      <p className="min-w-0 flex-1 text-sm font-medium tabular-nums text-[#203264] lg:flex-none"><time dateTime={values.from}>{formatReportDate(values.from)}</time> – <time dateTime={values.to}>{formatReportDate(values.to)}</time></p>
      <details className="group/date relative min-w-0 max-w-full shrink-0">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-[#203264] transition hover:border-[#5D94E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] [&::-webkit-details-marker]:hidden">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#365FA6]" aria-hidden="true" /><span className="sr-only">Date range: </span><span className="min-w-0 break-words">{dateLabel}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/date:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-full z-30 mt-2 max-h-[70dvh] w-80 max-w-[calc(100vw-3rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl [&>form]:grid-cols-1 [&>form]:gap-3 [&>form>div]:col-span-1 [&>form>div]:grid-cols-1">
          {form}
        </div>
      </details>
      </div>
    </CardContent></Card>;
  }
  return <Card><CardContent className="p-5">
    {form}
    <p className="mt-3 text-xs text-slate-500">Inclusive calendar dates in Asia/Manila. Date and grouping filters are saved in this page’s URL.</p>
  </CardContent></Card>;
}
