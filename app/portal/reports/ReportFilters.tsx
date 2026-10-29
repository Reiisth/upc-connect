"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AnalyticsBranch } from "@/lib/analytics/types";
import { REPORT_PRESETS, type ReportFilterValues } from "./filters";

export default function ReportFilters({ branches, values, onFiltersChange }: {
  branches: readonly AnalyticsBranch[]; values: ReportFilterValues; onFiltersChange?: () => void;
}) {
  const [preset, setPreset] = useState(values.preset);
  return <Card><CardContent className="p-5">
    <form action="/portal/reports" method="get" onChange={onFiltersChange} onSubmit={onFiltersChange}
      className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Report filters">
      <FormField label="Branch" htmlFor="report-branch" className="min-w-0">
        <Select id="report-branch" name="branch" defaultValue={values.branch}>
          <option value="">All Accessible Branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{!branch.isActive ? " (inactive)" : ""}</option>)}
        </Select>
      </FormField>
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
      <div className={preset === "custom" ? "grid gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-span-4" : "hidden"}>
        <FormField label="From" htmlFor="report-from">
          <Input id="report-from" name="from" type="date" min="0001-01-01" defaultValue={values.from} required={preset === "custom"} disabled={preset !== "custom"} />
        </FormField>
        <FormField label="To" htmlFor="report-to">
          <Input id="report-to" name="to" type="date" min="0001-01-01" defaultValue={values.to} required={preset === "custom"} disabled={preset !== "custom"} />
        </FormField>
      </div>
    </form>
    <p className="mt-3 text-xs text-slate-500">Inclusive calendar dates in Asia/Manila. Filters are saved in this page’s URL.</p>
  </CardContent></Card>;
}
