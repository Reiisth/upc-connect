"use client";

import { useId } from "react";
import { Chart as ChartJS, Filler, ArcElement, DoughnutController, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip, type ChartOptions } from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReportMoney, formatReportNumber, relativeMoneyCoordinates } from "./presentation";

ChartJS.register(Filler, ArcElement, DoughnutController, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip);
const COLORS = ["#365FA6", "#16836B", "#B7791F", "#8B5CB5"];
export type ReportChartSeries = { label: string; values: (number | string | null)[]; color?: string };
export type ReportChartProps = {
  title: string; description?: string; labels: string[]; series: ReportChartSeries[];
  appearance?: "attendance"; categoryColors?: string[]; compact?: boolean; kind?: "line" | "bar" | "doughnut"; stacked?: boolean; centerValue?: number; money?: boolean; horizontal?: boolean; emptyMessage: string;
};

export default function ReportChart({ title, description, labels, series, compact = false, kind = "bar", stacked = false, centerValue, categoryColors, appearance, money = false, horizontal = false, emptyMessage }: ReportChartProps) {
  const id = useId();
  const refined=appearance==="attendance";
  const coordinates = money ? relativeMoneyCoordinates(series.map((item) => item.values.map((value) => typeof value === "string" ? value : null))) :
    series.map((item) => item.values.map((value) => typeof value === "number" && Number.isFinite(value) ? value : null));
  const hasData = labels.length > 0 && coordinates.some((values) => values.some((value) => value !== null && value !== 0));
  const formatValue = (value: number | string | null) => money ? formatReportMoney(typeof value === "string" ? value : null) : formatReportNumber(typeof value === "number" ? value : null);
  const data = {
    labels: labels.map((label) => label.length > 26 ? `${label.slice(0, 25)}…` : label),
    datasets: series.map((item, index) => ({ label: item.label, data: coordinates[index],
      backgroundColor: refined && kind === "line" ? "rgba(93,148,232,0.10)" : item.color ?? COLORS[index % COLORS.length], borderColor: item.color ?? COLORS[index % COLORS.length],
      borderRadius: refined ? 6 : 4, borderSkipped: refined ? false : undefined, borderWidth: kind === "line" ? 2 : 0, pointRadius: refined ? 2 : 3, pointHoverRadius: 5, pointBackgroundColor:item.color ?? COLORS[index % COLORS.length], tension: refined ? 0.3 : 0.15, cubicInterpolationMode: refined ? "monotone" as const : "default" as const, fill:refined && kind === "line",
    })),
  };
  const numericAxis = {
    stacked, beginAtZero: true, min: 0, ...(money ? { max: 100 } : {}),
    grid: { color: refined ? "#F0F4FA" : "#E8EDF5" }, border: { display: false },
    title: { display: money, text: "Relative amount", color: "#64748B", font: { size: 11 } },
    ticks: { maxTicksLimit: 5, precision: 0, color: refined ? "#8593A8" : "#64748B", font: { size: 11 },
      callback: (value: string | number) => money ? `${value}%` : formatReportNumber(Number(value), 0) },
  };
  const categoryAxis = { stacked, grid: { display: false }, border: { display: false },
    ticks: { autoSkip: !horizontal, maxTicksLimit: horizontal ? undefined : 6, maxRotation: 30, color: refined ? "#8593A8" : "#64748B", font: { size: 11 } } };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false as const,
    indexAxis: horizontal ? "y" as const : "x" as const,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: series.length > 1 || Boolean(series[0]?.color), position: "bottom" as const, labels: { color: "#475569", boxWidth: 10, boxHeight: 10, padding: 16, usePointStyle:refined, pointStyle:"circle" as const } },
      tooltip: { backgroundColor: "#203264", cornerRadius:refined?10:6, padding: refined?10:12, callbacks: {
        title: (items: { dataIndex: number }[]) => labels[items[0]?.dataIndex] ?? "",
        label: (item: { dataIndex: number; datasetIndex: number }) => `${series[item.datasetIndex].label}: ${formatValue(series[item.datasetIndex].values[item.dataIndex])}`,
      } },
    },
    scales: { x: horizontal ? numericAxis : categoryAxis, y: horizontal ? categoryAxis : numericAxis },
  } satisfies ChartOptions<"line" | "bar">;

  const doughnutData = {labels, datasets:[{label:series[0]?.label ?? "Records",data:coordinates[0] ?? [],backgroundColor:categoryColors ?? COLORS,borderColor:refined?"#FFFFFF":"#64748B",borderWidth:refined?3:1,hoverOffset:refined?3:0}]};
  const doughnutOptions: ChartOptions<"doughnut"> = {responsive:true,maintainAspectRatio:false,animation:false,cutout:refined?"80%":"72%",
    plugins:{legend:{position:"bottom",labels:{color:"#475569",boxWidth:10,padding:14,usePointStyle:refined,pointStyle:"circle"}},tooltip:{backgroundColor:"#203264",cornerRadius:10,padding:10,callbacks:{label:item=>`${item.label}: ${formatReportNumber(Number(item.raw),0)} records`}}}};
  return <Card className={`min-w-0 ${refined?"rounded-2xl border-slate-100 shadow-sm":""}`}>
    <CardHeader className={compact ? "p-4 pb-2" : undefined}><CardTitle><h3 id={`${id}-title`} className="text-base leading-snug">{title}</h3></CardTitle>
      {description && <p className="text-xs leading-relaxed text-slate-500">{description}</p>}
    </CardHeader>
    <CardContent className={compact ? "p-4 pt-0" : undefined}>
      {!hasData ? <EmptyState title="No chart activity" description={emptyMessage} className={compact ? "min-h-[220px] px-3 py-6" : "min-h-64 px-3 py-8"} /> : <>
        <div className={`relative w-full min-w-0 ${refined?"px-1 pt-3":""}`} style={{ height: compact ? 220 : horizontal ? Math.min(480, Math.max(248, labels.length * 36)) : 256 }}>
          {kind === "doughnut" ? <>
            <Doughnut data={doughnutData} options={doughnutOptions} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} />
            {centerValue !== undefined && <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2 text-center"><p className="text-2xl font-semibold text-[#203264]">{formatReportNumber(centerValue,0)}</p><p className="text-xs text-slate-500">Total records</p></div>}
          </> : kind === "line" ? <Line data={data} options={options} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} /> :
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
