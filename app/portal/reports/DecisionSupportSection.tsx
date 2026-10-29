"use client";

import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AnalyticsRequest } from "@/lib/analytics/types";
import type { DecisionSupportDisplayEvidence, DecisionSupportResult } from "@/lib/ai/types";
import { generateReportInsights } from "./actions";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "./presentation";

type Insights = Extract<DecisionSupportResult, { ok: true }>;
const groupingLabels = { day: "Daily grouping", week: "Weekly grouping", month: "Monthly grouping" };
const severityLabels = { info: "Info", attention: "Attention", important: "Important" };
const priorityLabels = { low: "Low", medium: "Medium", high: "High" };

function evidenceValue(item: DecisionSupportDisplayEvidence, branches: Insights["branchLabels"]): string {
  if (item.value === null) return "Unavailable";
  if (item.format === "money") return formatReportMoney(typeof item.value === "string" ? item.value : null);
  if (item.format === "percent") return formatReportPercent(typeof item.value === "number" ? item.value : null);
  if (item.format === "date") return formatReportDate(String(item.value));
  if (typeof item.value === "number") return formatReportNumber(item.value);
  if (typeof item.value === "boolean") return item.value ? "Yes" : "No";
  if (item.value === "all_accessible_branches") return "All accessible branches";
  if (item.value === "one_accessible_branch") return "Selected accessible branch";
  if (item.value === "day" || item.value === "week" || item.value === "month") return groupingLabels[item.value];
  return branches.find((branch) => branch.label === item.value)?.displayName ?? item.value.replaceAll("_", " ");
}

function Evidence({ paths, result }: { paths: readonly string[]; result: Insights }) {
  // Only the server's resolved values/labels are displayed; model prose cannot supply evidence values.
  const items = paths.map((path) => result.evidence.find((item) => item.path === path)).filter((item) => item !== undefined);
  return <div className="mt-3 text-sm">
    <p className="font-medium text-slate-700">Report evidence</p>
    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
      {items.map((item) => <li key={item.path}>{item.label}: <span className="font-medium tabular-nums text-slate-800">{evidenceValue(item, result.branchLabels)}</span></li>)}
    </ul>
  </div>;
}

export function DecisionSupportResults({ result }: { result: Insights }) {
  const { insight, reportingContext } = result;
  const branch = reportingContext.branchScope.mode === "all_accessible_branches"
    ? "All accessible branches" : result.branchLabels[0]?.displayName ?? "Selected accessible branch";
  return <div className="min-w-0 space-y-6 break-words">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <p className="font-medium text-slate-800">Generated for</p>
      <ul className="mt-1 space-y-1">
        <li>{branch}</li>
        <li>{formatReportDate(reportingContext.dateRange.from)} – {formatReportDate(reportingContext.dateRange.to)} (inclusive, Asia/Manila)</li>
        <li>{groupingLabels[reportingContext.grouping]}</li>
        <li>Current-state metrics as of {formatReportDate(reportingContext.asOfDate)}</li>
      </ul>
    </div>
    <section aria-labelledby="ai-executive-summary">
      <h3 id="ai-executive-summary" className="font-prompt text-lg font-semibold text-[#203264]">Executive Summary</h3>
      <p className="mt-1 text-xs font-medium text-slate-500">AI-generated summary</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{insight.executiveSummary}</p>
    </section>
    <section aria-labelledby="ai-key-findings">
      <h3 id="ai-key-findings" className="font-prompt text-lg font-semibold text-[#203264]">Key Findings</h3>
      <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-2">
        {insight.keyFindings.map((finding, index) => <article key={index} className="min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="font-prompt font-medium text-slate-900">{finding.title}</h4>
            <StatusBadge variant={finding.severity === "info" ? "info" : "warning"}>Severity: {severityLabels[finding.severity]}</StatusBadge>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{finding.observation}</p>
          <Evidence paths={finding.evidence} result={result} />
        </article>)}
      </div>
      {!insight.keyFindings.length && <p className="mt-2 text-sm text-slate-600">No supported key findings were returned for this report.</p>}
    </section>
    <section aria-labelledby="ai-recommendations">
      <h3 id="ai-recommendations" className="font-prompt text-lg font-semibold text-[#203264]">Advisory Recommendations</h3>
      <p className="mt-1 text-sm text-slate-600">Recommendations are advisory and should be reviewed by church leadership before action.</p>
      <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-2">
        {insight.recommendations.map((item, index) => <article key={index} className="min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="font-prompt font-medium text-slate-900">{item.title}</h4>
            <StatusBadge variant={item.priority === "high" ? "warning" : "default"}>Priority: {priorityLabels[item.priority]}</StatusBadge>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{item.recommendation}</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600"><span className="font-medium text-slate-700">Rationale: </span>{item.rationale}</p>
          <Evidence paths={item.evidence} result={result} />
        </article>)}
      </div>
      {!insight.recommendations.length && <p className="mt-2 text-sm text-slate-600">No advisory recommendations were returned for this report.</p>}
    </section>
    <section aria-labelledby="ai-limitations">
      <h3 id="ai-limitations" className="font-prompt text-lg font-semibold text-[#203264]">Limitations</h3>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
        {insight.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}
      </ul>
    </section>
  </div>;
}

export default function DecisionSupportSection({ filters, filtersChanged = false }: { filters: AnalyticsRequest; filtersChanged?: boolean }) {
  const [result, setResult] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestPending = useRef(false);

  function generate() {
    if (requestPending.current || filtersChanged) return;
    requestPending.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const response = await generateReportInsights(filters);
        if (response.ok) setResult(response);
        else setError(response.error.message);
      } catch {
        // Transport/framework failures never expose the exception to the page.
        setError("AI insights could not be generated right now. Please try again.");
      } finally {
        requestPending.current = false;
      }
    });
  }

  return <section id="ai-decision-support" aria-labelledby="ai-decision-support-title" className="min-w-0 scroll-mt-6">
    <Card><CardContent className="min-w-0 space-y-6 p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="ai-decision-support-title" className="font-radio-canada text-xl font-semibold text-[#203264]">AI Decision Support</h2>
          <StatusBadge variant="info">Advisory</StatusBadge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Generate an AI-assisted interpretation of the current report. Gemini uses only aggregated analytics visible within your current branch scope.</p>
        <div className="mt-4 flex flex-col items-start gap-3">
          <Button type="button" onClick={generate} disabled={pending || filtersChanged} aria-describedby="ai-privacy ai-cooldown">
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {pending ? "Analyzing report data..." : result ? "Regenerate Insights" : "Generate AI Insights"}
          </Button>
          <p id="ai-privacy" className="max-w-3xl text-xs leading-relaxed text-slate-500">Only aggregated report metrics are sent for AI analysis. Member names, contact information, attendance rows, contribution identities, and follow-up notes are not included.</p>
          <p id="ai-cooldown" className="text-xs text-slate-500">Requests for the same report filters have a 30-second cooldown.</p>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 text-sm text-slate-600">
          {filtersChanged ? "Report filters changed. Apply filters before generating new insights." : pending ? "Analyzing report data..." : result ? "AI insights generated. Review the advisory interpretation below." : "Insights are generated only when you choose Generate AI Insights."}
        </p>
        {error && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      </div>
      {result && <DecisionSupportResults result={result} />}
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-[#203264]">AI insights may be incomplete or incorrect. Verify important conclusions using the underlying Reports data.</p>
    </CardContent></Card>
  </section>;
}
