import "server-only";
import type { SavedReportResult } from "./report-documents";
import type { DecisionSupportDisplayEvidence } from "./types";
import { formatReportDate, formatReportMoney, formatReportNumber, formatReportPercent } from "@/app/portal/reports/presentation";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const displayLabel = (label: string) => label.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => {
  const formatted = formatReportDate(date);
  return formatted === "Unavailable" ? date : formatted;
});

/** Display-only formatting. Model text is always escaped, never interpreted as HTML.
 * Require explicit PHP/peso markers for currency; preserve dates and identifiers. */
export function formatDocumentProse(text: string): string {
  const tokens = /\b\d{4}-\d{2}-\d{2}\b|(?:(?:PHP|₱)\s*)?-?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:PHP|%))?/gi;
  let html = "", end = 0;
  for (const match of text.matchAll(tokens)) {
    const start = match.index;
    html += escape(text.slice(end, start));
    const token = match[0];
    const before = text[start - 1] ?? "", after = text[start + token.length] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      const date = formatReportDate(token);
      html += escape(date === "Unavailable" ? token : date);
    } else if (/[\p{L}\p{N}_/-]/u.test(before) || /[\p{L}\p{N}_/-]/u.test(after)) {
      html += escape(token);
    } else {
      const number = token.replace(/PHP|₱|%|\s|,/gi, "");
      const money = /PHP|₱/i.test(token), percent = token.includes("%");
      const sign = number.startsWith("-") ? "−" : "", unsigned = number.replace(/^-/, "");
      const group = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      let formatted: string;
      if (money && /^\d+(?:\.\d{1,2})?$/.test(unsigned)) formatted = sign + formatReportMoney(unsigned);
      else if (money) formatted = token;
      else if (percent && Number.isFinite(Number(number))) formatted = formatReportPercent(Number(number));
      else if (!number.includes(".")) formatted = sign + group(unsigned);
      else if (Number.isFinite(Number(number)) && Math.abs(Number(number)) <= Number.MAX_SAFE_INTEGER) formatted = formatReportNumber(Number(number));
      else formatted = sign + group(unsigned.split(".")[0]) + "." + unsigned.split(".")[1];
      html += `<strong class="figure">${escape(formatted)}</strong>`;
    }
    end = start + token.length;
  }
  return html + escape(text.slice(end));
}

function rating(value: string) {
  const ratings: Record<string, { label: string; color: string }> = {
    info: { label: "Info", color: "blue" }, attention: { label: "Attention", color: "amber" }, important: { label: "Important", color: "red" },
    low: { label: "Low", color: "blue" }, medium: { label: "Medium", color: "amber" }, high: { label: "High", color: "red" },
  };
  const item = Object.hasOwn(ratings, value) ? ratings[value] : { label: "Unrated", color: "slate" };
  return `<span class="rating ${item.color}">${item.label}</span>`;
}

/** Standalone HTML shared by open/download/print. Only stored, cited evidence is featured. */
export function renderReportDocument(result: SavedReportResult) {
  const { insight, reportingContext: context } = result;
  function displayValue(item: DecisionSupportDisplayEvidence) {
    return item.value === null ? "Unavailable" : item.format === "money" ? formatReportMoney(String(item.value))
      : item.format === "percent" ? formatReportPercent(typeof item.value === "number" ? item.value : null)
      : item.format === "date" ? formatReportDate(String(item.value))
      : typeof item.value === "number" ? formatReportNumber(item.value)
      : typeof item.value === "boolean" ? item.value ? "Yes" : "No"
      : result.branchLabels.find(branch => branch.label === item.value)?.displayName ?? String(item.value).replaceAll("_", " ");
  }
  function evidence(paths: readonly string[]) {
    const items = paths.map(path => result.evidence.find(entry => entry.path === path)).filter((item): item is DecisionSupportDisplayEvidence => Boolean(item));
    return items.length ? `<div class="evidence"><p class="eyebrow">Supporting figures</p><dl>${items.map(item => `<div><dt>${escape(displayLabel(item.label))}</dt><dd>${escape(displayValue(item))}</dd></div>`).join("")}</dl></div>` : "";
  }
  const featuredPaths = ["contributions.totalAmount", "attendance.physicalCheckIns", "baptisms.total", "inactivity.needsFollowUpMembers", "membership.nonArchivedMembers", "followUps.total"];
  const candidates = [...featuredPaths.flatMap(path => result.evidence.filter(e => e.path === path)), ...result.evidence];
  const featured = candidates.filter((item, index, all) => item.value !== null && ["number", "money", "percent"].includes(item.format) && all.findIndex(e => e.path === item.path) === index).slice(0, 4);
  const metrics = featured.length ? `<section class="metrics" aria-label="Highlighted report figures">${featured.map(item => `<div class="metric"><p>${escape(displayLabel(item.label))}</p><strong>${escape(displayValue(item))}</strong></div>`).join("")}</section>` : "";
  const generated = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(result.generatedAt));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UPC Connect - AI Report</title><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#334155;margin:0;background:#eef3fb;line-height:1.6;font-size:14px}main{max-width:900px;margin:24px auto;background:#fff;padding:38px;border:1px solid #dbe3ef;border-radius:16px}header{border-top:5px solid #5d94e8;padding-top:20px}.brand{font-size:12px;font-weight:800;letter-spacing:.15em;color:#365fa6;margin:0 0 6px}h1{font-size:29px;line-height:1.2;color:#203264;margin:0 0 18px}h2{font-size:19px;color:#203264;margin:30px 0 12px;padding-bottom:8px;border-bottom:2px solid #e8eef8}h3{font-size:16px;color:#203264;margin:0;line-height:1.4}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}li,dt,dd{overflow-wrap:anywhere}.context{display:grid;grid-template-columns:1fr 1fr;gap:14px 22px;margin:0;padding:16px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.context div{min-width:0}.context dt,.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;color:#64748b}.context dd{margin:3px 0 0;color:#203264;font-size:12px}.advisory{margin-top:20px;padding:12px 14px;border-left:3px solid #5d94e8;background:#f3f7fd;font-size:12px;color:#475569}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0}.metric{background:#f2f6fc;border:1px solid #dbe6f5;border-radius:10px;padding:14px;min-width:0}.metric p{margin:0 0 6px;color:#526682;font-size:11px}.metric strong{display:block;font-size:23px;line-height:1.25;color:#203264;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.summary{font-size:15px;line-height:1.8}.figure{color:#203264;font-weight:750;font-variant-numeric:tabular-nums}article{margin:0 0 14px;padding:16px;border:1px solid #dce5f1;border-radius:10px;break-inside:avoid}.article-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rating{display:inline-block;flex-shrink:0;font-size:10px;font-weight:700;padding:3px 9px;border:1px solid;border-radius:999px;line-height:1.5}.blue{color:#1d4ed8;background:#eff6ff;border-color:#bfdbfe}.amber{color:#92400e;background:#fffbeb;border-color:#fcd34d}.red{color:#b91c1c;background:#fef2f2;border-color:#fecaca}.slate{color:#475569;background:#f1f5f9;border-color:#cbd5e1}.evidence{margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0}.evidence .eyebrow{margin:0 0 7px}.evidence dl{margin:0}.evidence dl div{display:grid;grid-template-columns:minmax(0,1fr) minmax(80px,auto);align-items:baseline;gap:16px;margin:5px 0;font-size:11px}.evidence dt{color:#64748b}.evidence dd{font-weight:700;color:#203264;text-align:right;margin:0;font-variant-numeric:tabular-nums}.rationale{font-size:12px;color:#64748b}.limitations{font-size:12px;padding-left:20px}.limitations li{margin-bottom:7px}footer{margin-top:28px;padding-top:12px;border-top:1px solid #dbe3ef;font-size:10px;color:#64748b}.tools{max-width:900px;margin:16px auto;display:flex;align-items:center;gap:16px;padding:0 12px}button{border:0;border-radius:8px;padding:10px 18px;background:#203264;color:#fff;cursor:pointer}.tools span{font-size:12px}
    /* Readable screen typography, including supporting evidence and ratings. */
    body{font-size:16px;line-height:1.7;color:#24354e}h1{font-size:36px}h2{font-size:26px}h3{font-size:21px}.brand{font-size:15px}.context{gap:18px 24px}.context dt,.eyebrow{font-size:14px;color:#475569}.context dd{font-size:16px}.advisory{font-size:16px;line-height:1.75}.metric{padding:18px}.metric p{font-size:16px;color:#475569}.metric strong{font-size:32px}.summary{font-size:18px;line-height:1.75}.rating{font-size:16px;padding:5px 12px}.evidence dl div{font-size:16px;margin:10px 0}.evidence dt{color:#475569}.rationale,.limitations{font-size:16px;color:#475569}footer{font-size:14px;color:#475569}.tools span{font-size:16px}button{font-size:18px;min-height:48px}article{padding:20px}.summary,article>p{max-width:70ch}
    @media(max-width:600px){main{margin:12px;padding:20px;border-radius:12px}h1{font-size:30px}.context{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.article-heading{flex-wrap:wrap}.evidence dl div{grid-template-columns:1fr;gap:0}.evidence dd{text-align:left}.tools{flex-wrap:wrap}}
    @media print{body{background:#fff;font-size:12pt;line-height:1.65}main{margin:0;padding:0;border:0;border-radius:0;max-width:none}.tools{display:none}header,.context,.metric{break-inside:avoid}h2,h3{break-after:avoid}h1{font-size:24pt}h2{font-size:19pt}h3{font-size:16pt}.context dt,.eyebrow{font-size:12pt}.context dd,.advisory,.metric p{font-size:13pt}.evidence dl div,.rationale,.limitations{font-size:12pt}.rating{font-size:12pt}footer{font-size:11pt}article{padding:16px;margin-bottom:10px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric strong{font-size:24pt}.rating,.metric,.advisory{print-color-adjust:exact;-webkit-print-color-adjust:exact}.summary{font-size:13pt}a{color:inherit}}
    </style></head><body><div class="tools"><button type="button" onclick="window.print()">Print / Save as PDF</button><span>Use your browser's print dialog to print or save as PDF.</span></div><main>
    <header><p class="brand">UPC CONNECT · REPORTS &amp; ANALYTICS</p><h1>AI Decision Support Report</h1>
    <dl class="context"><div><dt>Reporting period</dt><dd>${escape(formatReportDate(context.dateRange.from))} – ${escape(formatReportDate(context.dateRange.to))}</dd></div><div><dt>Generated · Asia/Manila</dt><dd>${escape(generated)}</dd></div><div><dt>Branches</dt><dd>${escape(result.branchLabels.map(branch => branch.displayName).join(", "))}</dd></div><div><dt>Reporting context</dt><dd>${escape(context.grouping[0].toUpperCase() + context.grouping.slice(1))} grouping · Current metrics as of ${escape(formatReportDate(context.asOfDate))}</dd></div></dl></header>
    <p class="advisory">AI-generated advisory report. Verify important conclusions using the underlying Reports data. Recommendations require human review.</p>
    ${metrics}<section><h2>Executive Summary</h2><p class="summary">${formatDocumentProse(insight.executiveSummary)}</p></section>
    <section><h2>Key Findings</h2>${insight.keyFindings.map(item => `<article><div class="article-heading"><h3>${escape(item.title)}</h3>${rating(item.severity)}</div><p>${formatDocumentProse(item.observation)}</p>${evidence(item.evidence)}</article>`).join("") || "<p>No supported key findings.</p>"}</section>
    <section><h2>Advisory Recommendations</h2>${insight.recommendations.map(item => `<article><div class="article-heading"><h3>${escape(item.title)}</h3>${rating(item.priority)}</div><p>${formatDocumentProse(item.recommendation)}</p><p class="rationale"><strong>Rationale:</strong> ${formatDocumentProse(item.rationale)}</p>${evidence(item.evidence)}</article>`).join("") || "<p>No advisory recommendations.</p>"}</section>
    <section><h2>Limitations</h2><ul class="limitations">${insight.limitations.map(item => `<li>${formatDocumentProse(item)}</li>`).join("")}</ul></section>
    <footer>UPC Connect · Advisory analysis for authorized review<br>Model: ${escape(result.model)} · Prompt version: ${escape(result.promptVersion)} · Dates use Asia/Manila.</footer>
    </main></body></html>`;
}
