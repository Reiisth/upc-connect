"use client";

import { useId } from "react";
import { Chart as ChartJS, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip, type ChartOptions } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReportMoney, formatReportNumber, relativeMoneyCoordinates } from "./presentation";

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip);
const COLORS = ["#365FA6", "#16836B", "#B7791F", "#8B5CB5"];
export type ReportChartSeries = { label: string; values: (number | string | null)[]; color?: string };
export type ReportChartProps = {
  title: string; description?: string; labels: string[]; series: ReportChartSeries[];
  kind?: "line" | "bar"; money?: boolean; horizontal?: boolean; emptyMessage: string;
};

export default function ReportChart({ title, description, labels, series, kind = "bar", money = false, horizontal = false, emptyMessage }: ReportChartProps) {
  const id = useId();
  const coordinates = money ? relativeMoneyCoordinates(series.map((item) => item.values.map((value) => typeof value === "string" ? value : null))) :
    series.map((item) => item.values.map((value) => typeof value === "number" && Number.isFinite(value) ? value : null));
  const hasData = labels.length > 0 && coordinates.some((values) => values.some((value) => value !== null && value !== 0));
  const formatValue = (value: number | string | null) => money ? formatReportMoney(typeof value === "string" ? value : null) : formatReportNumber(typeof value === "number" ? value : null);
  const data = {
    labels: labels.map((label) => label.length > 26 ? `${label.slice(0, 25)}…` : label),
    datasets: series.map((item, index) => ({ label: item.label, data: coordinates[index],
      backgroundColor: item.color ?? COLORS[index % COLORS.length], borderColor: item.color ?? COLORS[index % COLORS.length],
      borderRadius: 4, borderWidth: kind === "line" ? 2 : 0, pointRadius: 3, pointHoverRadius: 5, tension: 0.15,
    })),
  };
  const numericAxis = {
    beginAtZero: true, min: 0, ...(money ? { max: 100 } : {}),
    grid: { color: "#E8EDF5" }, border: { display: false },
    title: { display: money, text: "Relative amount", color: "#64748B", font: { size: 11 } },
    ticks: { maxTicksLimit: 5, precision: 0, color: "#64748B", font: { size: 11 },
      callback: (value: string | number) => money ? `${value}%` : formatReportNumber(Number(value), 0) },
  };
  const categoryAxis = { grid: { display: false }, border: { display: false },
    ticks: { autoSkip: !horizontal, maxTicksLimit: horizontal ? undefined : 6, maxRotation: 30, color: "#64748B", font: { size: 11 } } };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false as const,
    indexAxis: horizontal ? "y" as const : "x" as const,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: series.length > 1, position: "bottom" as const, labels: { color: "#475569", boxWidth: 10, boxHeight: 10, padding: 16 } },
      tooltip: { backgroundColor: "#203264", padding: 12, callbacks: {
        title: (items: { dataIndex: number }[]) => labels[items[0]?.dataIndex] ?? "",
        label: (item: { dataIndex: number; datasetIndex: number }) => `${series[item.datasetIndex].label}: ${formatValue(series[item.datasetIndex].values[item.dataIndex])}`,
      } },
    },
    scales: { x: horizontal ? numericAxis : categoryAxis, y: horizontal ? categoryAxis : numericAxis },
  } satisfies ChartOptions<"line" | "bar">;

  return <Card className="min-w-0">
    <CardHeader><CardTitle><h3 id={`${id}-title`} className="text-base leading-snug">{title}</h3></CardTitle>
      {description && <p className="text-xs leading-relaxed text-slate-500">{description}</p>}
    </CardHeader>
    <CardContent>
      {!hasData ? <EmptyState title="No chart activity" description={emptyMessage} className="min-h-64 px-3 py-8" /> : <>
        <div className="relative w-full min-w-0" style={{ height: horizontal ? Math.min(480, Math.max(248, labels.length * 36)) : 256 }}>
          {kind === "line" ? <Line data={data} options={options} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} /> :
            <Bar data={data} options={options} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} />}
        </div>
        {money && <p className="mt-2 text-xs text-slate-500">Relative to the largest amount. Hover or view data for exact peso values.</p>}
      </>}
      {labels.length > 0 && <details className="mt-4 text-xs text-slate-600">
        <summary className="w-fit cursor-pointer rounded py-1 font-medium text-[#365FA6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">View chart data</summary>
        <div className="mt-3 max-h-72 overflow-y-auto">
          <Table><caption className="sr-only">{title} data</caption>
            <TableHeader><TableRow><TableHead scope="col">Period / Category</TableHead>{series.map((item) => <TableHead key={item.label} scope="col" className="text-right">{item.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{labels.map((label, index) => <TableRow key={`${label}-${index}`}>
              <TableHead scope="row" className="normal-case tracking-normal">{label}</TableHead>
              {series.map((item) => <TableCell key={item.label} className="whitespace-nowrap text-right tabular-nums">{formatValue(item.values[index])}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </div>
      </details>}
    </CardContent>
  </Card>;
}
