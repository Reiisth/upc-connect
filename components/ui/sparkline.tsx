"use client";

import { chartCeiling } from "@/lib/chart-scale";
import { useChartScale } from "./use-chart-scale";

type SparklineProps = { values: readonly number[]; label: string; scaleKey: string; className?: string };

/** A miniature trend that keeps its zero baseline and scale when filters reduce values. */
export function Sparkline({ values, label, scaleKey, className }: SparklineProps) {
  const width = 320, height = 88, padding = 5;
  const safe = values.length ? values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0) : [0];
  const max = useChartScale(scaleKey, chartCeiling(Math.max(0, ...safe)), true).max;
  const points = safe.map((value, index) => ({
    x: safe.length === 1 ? width / 2 : padding + index * (width - padding * 2) / (safe.length - 1),
    y: height - padding - value / max * (height - padding * 2),
  }));
  const line = points.length === 1 ? `${padding},${points[0].y} ${width - padding},${points[0].y}` : points.map(point => `${point.x},${point.y}`).join(" ");
  const last = points[points.length - 1];
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={className} preserveAspectRatio="none">
    <title>{label}</title>
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.12" />
    <polygon points={`${padding},${height - padding} ${line} ${width - padding},${height - padding}`} fill="currentColor" fillOpacity="0.08" />
    <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <circle cx={last.x} cy={last.y} r="3.5" fill="currentColor" />
  </svg>;
}
