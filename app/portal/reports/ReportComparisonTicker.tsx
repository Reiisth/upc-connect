import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { contributionTicker } from "@/lib/contribution-comparison";

export type ReportComparison = { current: number | string | null; previous: number | string | null };

export default function ReportComparisonTicker({ comparison }: { comparison: ReportComparison }) {
  const ticker = contributionTicker(comparison.current, comparison.previous);
  const Icon = ticker.direction === "up" ? ArrowUpRight : ticker.direction === "down" ? ArrowDownRight : ArrowRight;
  const color = ticker.direction === "up" ? "text-emerald-600" : ticker.direction === "down" ? "text-red-600" : "text-slate-500";
  const text = ticker.percent === null ? ticker.label : `${ticker.percent} ${ticker.label}`;
  return <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${color}`}
    aria-label={`${ticker.direction === "flat" ? "" : `${ticker.direction} `}${text}`}>
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{text}
  </p>;
}
