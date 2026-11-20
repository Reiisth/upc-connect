"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AnalyticsDateRange, AnalyticsGrouping } from "@/lib/analytics/types";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { loadMigrationTrend } from "./migration-trend-actions";
import ReportChart from "./ReportChart";
import { formatReportDate } from "./presentation";

const MOVEMENTS = [
  { key: "incoming", label: "Transfers In", color: "#5D94E8" },
  { key: "outgoing", label: "Transfers Out", color: "#94A3B8" },
  { key: "departures", label: "Departures", color: "#B7791F" },
  { key: "returns", label: "Returns", color: "#16836B" },
] as const;
type Movement = typeof MOVEMENTS[number]["key"];

export default function MigrationMovementChart({ trend, branches = [], range, grouping = "week" }: {
  trend: MigrationAnalytics["trend"]; branches?: Pick<MigrationAnalytics["branches"][number], "id" | "name">[];
  range?: AnalyticsDateRange; grouping?: AnalyticsGrouping;
}) {
  const id = useId();
  const [visible, setVisible] = useState<Movement[]>(MOVEMENTS.map(movement => movement.key));
  const [branchId, setBranchId] = useState("");
  const [branchTrend, setBranchTrend] = useState<MigrationAnalytics["trend"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestNumber = useRef(0);
  useEffect(() => () => { requestNumber.current++; }, []);
  async function chooseBranch(value: string) {
    const request = ++requestNumber.current;
    setBranchId(value); setError(null); setBranchTrend([]);
    if (!value || !range) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await loadMigrationTrend({ branchId: value, range: { preset: "custom", from: range.from, to: range.to }, grouping });
      if (request !== requestNumber.current) return;
      if (result.ok) setBranchTrend(result.trend);
      else setError(result.error);
    } catch {
      if (request !== requestNumber.current) return;
      setError("Branch movements could not be loaded. Please try again.");
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }
  const points = branchId ? branchTrend : trend;
  return <div aria-busy={loading} className="h-full [&>div:first-child]:h-full"><ReportChart title="Member Movement Over Time" kind="line" appearance="sparkline" compactHeader plotHeight={176} showLegend={false}
    headerActions={<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {branches.length > 1 && range && <div className="flex items-center gap-2">
        <label htmlFor={`${id}-branch`} className="text-xs font-medium text-slate-600">Branch</label>
        <Select id={`${id}-branch`} value={branchId} onChange={event => void chooseBranch(event.target.value)} className="w-48 text-sm">
          <option value="">All branches</option>
          {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </Select>
      </div>}
      {error && <Button type="button" variant="ghost" size="sm" onClick={() => void chooseBranch(branchId)}>Try again</Button>}
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="sr-only">Movements to display</legend>
      {MOVEMENTS.map(movement => <label key={movement.key} htmlFor={`${id}-${movement.key}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
        <Checkbox id={`${id}-${movement.key}`} checked={visible.includes(movement.key)} onCheckedChange={checked => setVisible(current => checked === true
          ? current.includes(movement.key) ? current : [...current, movement.key]
          : current.filter(key => key !== movement.key))} /><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{backgroundColor:movement.color}} />{movement.label}
      </label>)}
    </fieldset></div>}
    labels={visible.length ? points.map(point => formatReportDate(point.periodStart)) : []}
    series={MOVEMENTS.filter(movement => visible.includes(movement.key)).map(movement => ({ label: movement.label, color: movement.color, values: points.map(point => point[movement.key]) }))}
    emptyMessage={loading ? "Loading branch movements..." : error ?? (visible.length ? "No recorded movements in this selection." : "Select a movement to view its trend.")} />
    <span role={error ? "alert" : "status"} className="sr-only">{loading ? "Loading branch movements" : error ?? (branchId ? `Showing movements for ${branches.find(branch => branch.id === branchId)?.name ?? "selected branch"}` : "Showing movements for all branches")}</span>
  </div>;
}
