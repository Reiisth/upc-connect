"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ReportChart, { type ReportChartProps, type ReportChartSeries } from "./ReportChart";

type BranchChart = { id: string; name: string; labels: string[]; series: ReportChartSeries[]; unavailable?: boolean };

/** Choices contain only the authorized aggregates supplied by the server page. */
export default function ScopedReportChart({ branches = [], allowSeriesSelection = false, ...props }: Omit<ReportChartProps, "headerActions"> & {
  branches?: BranchChart[]; allowSeriesSelection?: boolean;
}) {
  const id = useId();
  const [branchId, setBranchId] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const branch = branches.find(branch => branch.id === branchId);
  const source = branch ?? props;
  const series = source.series.filter(item => !hidden.includes(item.label));
  return <ReportChart {...props} labels={series.length ? source.labels : []} series={series}
    showLegend={allowSeriesSelection ? false : props.showLegend}
    emptyMessage={branch?.unavailable ? "Data is unavailable for this branch." : !series.length ? "Select a series to view its trend." : props.emptyMessage}
    headerActions={<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {branches.length > 1 && <div className="flex items-center gap-2">
        <label htmlFor={`${id}-branch`} className="text-xs font-medium text-slate-600">Branch</label>
        <Select id={`${id}-branch`} className="w-48 text-sm" value={branch?.id ?? ""} onChange={event => setBranchId(event.target.value)}>
          <option value="">All branches</option>
          {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </Select>
      </div>}
      {allowSeriesSelection && <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="sr-only">Series to display</legend>
        {source.series.map((item,index) => <label key={item.label} htmlFor={`${id}-series-${index}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <Checkbox id={`${id}-series-${index}`} checked={!hidden.includes(item.label)} onCheckedChange={checked => setHidden(current => checked === true ? current.filter(label => label !== item.label) : current.includes(item.label) ? current : [...current,item.label])} />
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{backgroundColor:item.color ?? (index ? "#16836B" : "#5D94E8")}} />{item.label}
        </label>)}
      </fieldset>}
    </div>} />;
}
