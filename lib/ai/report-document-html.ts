import "server-only";
import type { SavedReportResult } from "./report-documents";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "@/app/portal/reports/presentation";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Complete standalone HTML artifact. Model content is always text, never executable markup. */
export function renderReportDocument(result: SavedReportResult) {
  const { insight, reportingContext: context } = result;
  function evidence(paths: readonly string[]) {
    return `<ul class="evidence">${paths.map(path => {
      const item = result.evidence.find(entry => entry.path === path);
      if (!item) return "";
      const value = item.value === null ? "Unavailable" : item.format === "money" ? formatReportMoney(String(item.value)) : item.format === "percent" ? formatReportPercent(typeof item.value === "number" ? item.value : null) : item.format === "date" ? formatReportDate(String(item.value)) : typeof item.value === "number" ? formatReportNumber(item.value) : result.branchLabels.find(branch => branch.label === item.value)?.displayName ?? String(item.value).replaceAll("_", " ");
      return `<li>${escape(item.label)}: <strong>${escape(value)}</strong></li>`;
    }).join("")}</ul>`;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UPC Connect - AI Report</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#203264;margin:0;background:#eef3fb;line-height:1.55}main{max-width:850px;margin:24px auto;background:white;padding:36px;border:1px solid #dbe3ef;border-radius:16px}h1{font-size:28px;margin:0 0 8px}h2{font-size:20px;border-bottom:1px solid #dbe3ef;padding-bottom:6px;margin-top:28px}h3{font-size:16px;margin:0 0 6px}p{white-space:pre-wrap;overflow-wrap:anywhere}li{overflow-wrap:anywhere}.context,.advisory{padding:14px;background:#f2f6fc;border:1px solid #dbe3ef;border-radius:8px}.context{font-size:13px}.evidence{font-size:12px;color:#475569}article{break-inside:avoid;border-bottom:1px solid #e2e8f0;padding:16px 0}.tag{font-size:12px;color:#475569}.tools{max-width:850px;margin:16px auto;display:flex;align-items:center;gap:16px;padding:0 12px}button{border:0;border-radius:8px;padding:10px 18px;background:#203264;color:white;cursor:pointer}.tools span{font-size:13px}@media print{body{background:white}main{margin:0;padding:0;border:0;border-radius:0;max-width:none}.tools{display:none}h2,h3{break-after:avoid}.context{break-inside:avoid}a{color:inherit}}
    </style></head><body><div class="tools"><button type="button" onclick="window.print()">Print / Save as PDF</button><span>Use your browser's print dialog to print or save as PDF.</span></div><main>
    <h1>UPC Connect - AI Decision Support Report</h1>
    <p class="advisory">AI-generated advisory report. Verify important conclusions using the underlying Reports data. Recommendations require human review.</p>
    <div class="context"><strong>Generated:</strong> ${escape(new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(result.generatedAt)))} (Asia/Manila)<br>
    <strong>Reporting period:</strong> ${escape(formatReportDate(context.dateRange.from))} - ${escape(formatReportDate(context.dateRange.to))}<br>
    <strong>Branches:</strong> ${escape(result.branchLabels.map(branch => branch.displayName).join(", "))}<br>
    <strong>Grouping:</strong> ${escape(context.grouping)} | <strong>Current metrics as of:</strong> ${escape(formatReportDate(context.asOfDate))}<br>
    <strong>Model:</strong> ${escape(result.model)} | <strong>Prompt version:</strong> ${escape(result.promptVersion)}</div>
    <h2>Executive Summary</h2><p>${escape(insight.executiveSummary)}</p>
    <h2>Key Findings</h2>${insight.keyFindings.map(item => `<article><h3>${escape(item.title)}</h3><span class="tag">Severity: ${escape(item.severity)}</span><p>${escape(item.observation)}</p>${evidence(item.evidence)}</article>`).join("") || "<p>No supported key findings.</p>"}
    <h2>Advisory Recommendations</h2>${insight.recommendations.map(item => `<article><h3>${escape(item.title)}</h3><span class="tag">Priority: ${escape(item.priority)}</span><p>${escape(item.recommendation)}</p><p><strong>Rationale:</strong> ${escape(item.rationale)}</p>${evidence(item.evidence)}</article>`).join("") || "<p>No advisory recommendations.</p>"}
    <h2>Limitations</h2><ul>${insight.limitations.map(item => `<li>${escape(item)}</li>`).join("")}</ul>
    </main></body></html>`;
}
