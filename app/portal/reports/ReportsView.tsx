"use client";

import { useState, type ReactNode } from "react";
import type { AnalyticsBranch, AnalyticsRequest } from "@/lib/analytics/types";
import type { ReportFilterValues } from "./filters";
import DecisionSupportSection from "./DecisionSupportSection";
import ReportFilters from "./ReportFilters";

/** Keep analytics as server-rendered children; coordinate only filter edits and ephemeral AI state. */
export default function ReportsView({ branches, values, insightFilters, children }: {
  branches: readonly AnalyticsBranch[]; values: ReportFilterValues;
  insightFilters: AnalyticsRequest | null; children: ReactNode;
}) {
  const [filtersChanged, setFiltersChanged] = useState(false);
  return <>
    <ReportFilters branches={branches} values={values} onFiltersChange={() => setFiltersChanged(true)} />
    {children}
    {insightFilters && <DecisionSupportSection key={`${JSON.stringify(insightFilters)}:${filtersChanged}`}
      filters={insightFilters} filtersChanged={filtersChanged} />}
  </>;
}
