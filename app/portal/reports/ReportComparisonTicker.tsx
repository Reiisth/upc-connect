import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { contributionTicker } from "@/lib/contribution-comparison";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export type ReportComparison = { current: number | string | null; previous: number | string | null };

export default function ReportComparisonTicker({ comparison, className }: { comparison: ReportComparison; className?: string }) {
  const ticker = contributionTicker(comparison.current, comparison.previous);
  const Icon = ticker.direction === "up" ? ArrowUpRight : ticker.direction === "down" ? ArrowDownRight : ArrowRight;
  const color = ticker.direction === "up" ? "text-emerald-600" : ticker.direction === "down" ? "text-red-600" : "text-slate-500";
  const text = ticker.percent === null ? ticker.label : `${ticker.percent} ${ticker.label}`;
  return <p className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-base font-semibold tabular-nums",color,className)}
    aria-label={`${ticker.direction === "flat" ? "" : `${ticker.direction} `}${text}`}>
    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{ticker.percent === null ? ticker.label : <AnimatedNumber value={ticker.percent} />}</span>
  </p>;
}
