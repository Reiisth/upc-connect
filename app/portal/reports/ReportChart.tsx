"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useChartScale, useChartReducedMotion } from "@/components/ui/use-chart-scale";
import { chartCeiling, chartExtent } from "@/lib/chart-scale";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AnimatedDisclosure } from "@/components/ui/animated-disclosure";
import { ChevronDown } from "lucide-react";
import { Chart as ChartJS, Filler, ArcElement, DoughnutController, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip, type ChartOptions, type Plugin } from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReportMoney, formatReportNumber, relativeMoneyCoordinates } from "./presentation";

ChartJS.register(Filler, ArcElement, DoughnutController, BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Legend, Tooltip);
const COLORS = ["#5D94E8", "#16836B", "#B7791F", "#8B5CB5"];
export type ReportChartSeries = { label: string; values: (number | string | null)[]; color?: string };
export type ReportChartProps = {
  headerActions?: ReactNode;
  showLegend?: boolean;
  plotHeight?: number;
  compactHeader?: boolean;
  className?: string;
  showZeroData?: boolean;
  title: string; description?: string; labels: string[]; series: ReportChartSeries[];
  moneyScale?: "relative"|"absolute"; appearance?: "attendance" | "sparkline"; categoryColors?: string[]; compact?: boolean; kind?: "line" | "bar" | "doughnut"; stacked?: boolean; centerValue?: number | string; cutout?: `${number}%`; centerLabel?: string; valueUnit?: string; money?: boolean; horizontal?: boolean; emptyMessage: string;
};

export default function ReportChart({ title, description, labels, series, headerActions, showLegend = true, plotHeight, compactHeader = false, className = "", showZeroData = false, compact = false, kind = "bar", stacked = false, cutout, centerValue, centerLabel = "Total records", valueUnit = "records", categoryColors, appearance, money = false, moneyScale="absolute", horizontal = false, emptyMessage }: ReportChartProps) {
  const id = useId();
  const modern = appearance === "sparkline";
  const chartWrapper = useRef<HTMLDivElement>(null);
  const tooltipElement = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const followPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[role="tooltip"]')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = tooltipElement.current?.getBoundingClientRect().width || Math.min(256, window.innerWidth - 48);
    const height = tooltipElement.current?.getBoundingClientRect().height || 200;
    const rightEdge = Math.min(bounds.right, window.innerWidth - 8);
    const preferredLeft = event.clientX + 12 + width <= rightEdge ? event.clientX + 12 : event.clientX - width - 12;
    const left = Math.max(8, Math.min(Math.max(bounds.left, preferredLeft), window.innerWidth - width - 8));
    const preferredTop = event.clientY + 12 + height <= window.innerHeight - 8 ? event.clientY + 12 : event.clientY - height - 12;
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
    setTooltipPosition({ left: left - bounds.left, top: top - bounds.top });
  };
  const [fontFamily, setFontFamily] = useState('"Radio Canada", sans-serif');
  const chartFont = { family: fontFamily };
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeDataset, setActiveDataset] = useState(0);
  const tooltipIndex = activeIndex === null || !labels.length ? null : Math.min(activeIndex, labels.length - 1);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setActiveIndex(null), 150); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (activeIndex === null) return;
    const dismiss = (event: PointerEvent) => { if (!chartWrapper.current?.contains(event.target as Node)) setActiveIndex(null); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [activeIndex]);
  const refined=appearance==="attendance";
  const relativeMoney=money&&moneyScale==="relative";
  const coordinates = money && !relativeMoney ? series.map(item=>item.values.map(value=>typeof value==="string"&&/^\d+(?:\.\d{1,2})?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null)) : money ? relativeMoneyCoordinates(series.map((item) => item.values.map((value) => typeof value === "string" ? value : null))) :
    series.map((item) => item.values.map((value) => typeof value === "number" && Number.isFinite(value) ? value : null));
  const hasData = labels.length > 0 && coordinates.some((values) => values.some((value) => value !== null && (showZeroData || value !== 0)));
  useEffect(() => {
    if (chartWrapper.current) setFontFamily(window.getComputedStyle(chartWrapper.current).fontFamily || '"Radio Canada", sans-serif');
  }, [hasData]);
  const stableScale = kind !== "doughnut" && !relativeMoney;
  const scaleKey = JSON.stringify([title, money ? "PHP" : "count", kind, horizontal, stacked, series.map(item => item.label)]);
  const scale = useChartScale(scaleKey, chartCeiling(chartExtent(coordinates, stacked), money), stableScale);
  const reduceMotion = useChartReducedMotion();
  const formatValue = (value: number | string | null) => money ? formatReportMoney(typeof value === "string" ? value : null) : formatReportNumber(typeof value === "number" ? value : null);
  const colors=series.map((item,index)=>{
    const color=item.color??COLORS[index%COLORS.length];
    return !refined && color.toUpperCase()==="#365FA6" ? "#5D94E8" : color;
  });
  const fadingFill = (color: string) => ({ chart }: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
    if (!chart.chartArea) return "transparent";
    const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
    gradient.addColorStop(0, `${color}3D`);
    gradient.addColorStop(1, `${color}00`);
    return gradient;
  };
  const data = {
    labels: labels.map((label) => label.length > 26 ? `${label.slice(0, 25)}…` : label),
    datasets: series.map((item, index) => ({ label: item.label, data: coordinates[index],
      valueLabels: item.values.map(value => value === null ? null : formatValue(value)),
      backgroundColor: kind === "bar" && series.length === 1 && categoryColors ? categoryColors : modern && kind === "line" ? fadingFill(colors[index]) : refined && kind === "line" ? "rgba(93,148,232,0.10)" : colors[index], borderColor: colors[index],
      hoverBackgroundColor: kind === "bar" && series.length === 1 && categoryColors ? categoryColors : colors[index], hoverBorderColor: colors[index], pointHoverBackgroundColor: colors[index], pointHoverBorderColor: "#FFFFFF", pointHoverBorderWidth: 2,
      borderRadius: refined ? 6 : 4, borderSkipped: refined ? false : undefined, borderWidth: kind === "line" ? 2 : 0, pointRadius: modern ? (coordinates[index].filter(value => value !== null).length === 1 ? 3 : 0) : refined ? 2 : 3, pointHoverRadius: 5, pointBackgroundColor:colors[index], tension: modern ? 0 : refined ? 0.3 : 0.15, cubicInterpolationMode: refined ? "monotone" as const : "default" as const, fill:(modern || refined) && kind === "line", spanGaps: false,
    })),
  };
  const barValueLabels: Plugin<"bar"> = {
    id: "barValueLabels",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const horizontalBars = chart.options.indexAxis === "y";
      ctx.save();
      ctx.font = `600 11px ${chart.options.font?.family ?? '"Radio Canada", sans-serif'}`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#475569";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!chart.isDatasetVisible(datasetIndex)) return;
        const values = (dataset as typeof data.datasets[number]).valueLabels;
        chart.getDatasetMeta(datasetIndex).data.forEach((element, index) => {
          const label = values?.[index];
          if (label === null || label === undefined || dataset.data[index] === null) return;
          const { x, y } = element.getProps(["x", "y"], false);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          const textWidth = ctx.measureText(label).width;
          ctx.textAlign = horizontalBars ? "left" : "center";
          const labelX = horizontalBars
            ? Math.max(chartArea.left + 2, Math.min(x + 6, chart.width - textWidth - 4))
            : Math.max(textWidth / 2 + 4, Math.min(x, chart.width - textWidth / 2 - 4));
          const labelY = horizontalBars ? y : Math.max(10, y - 10);
          ctx.strokeText(label, labelX, labelY, chart.width - 8);
          ctx.fillText(label, labelX, labelY, chart.width - 8);
        });
      });
      ctx.restore();
    },
  };
  const numericAxis = {
    stacked, beginAtZero: true, min: 0, max: relativeMoney ? 100 : scale.max,
    grid: { display: true, color: modern ? "#CBD5E173" : refined ? "#F0F4FA" : "#E8EDF5" }, border: { display: false },
    title: { display: money, text: relativeMoney?"Relative amount":"Amount (PHP)", color: "#64748B", font: { ...chartFont, size: 11 } },
    ticks: { maxTicksLimit: 5, precision: 0, color: refined ? "#8593A8" : "#64748B", font: { ...chartFont, size: 11 },
      callback: (value: string | number) => money ? relativeMoney?`${value}%`:new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value)) : formatReportNumber(Number(value), 0) },
  };
  const categoryAxis = { stacked, grid: { display: modern || horizontal, color: "#CBD5E173" }, border: { display: false, dash: [2, 3] },
    ticks: { autoSkip: !horizontal, maxTicksLimit: horizontal ? undefined : 6, maxRotation: 30, color: refined ? "#8593A8" : "#64748B", font: { ...chartFont, size: 11 } } };
  const options = {
    font: chartFont,
    layout: { padding: kind === "bar" ? horizontal ? { right: 48 } : { top: 18 } : 0 },
    responsive: true, maintainAspectRatio: false, animation: reduceMotion ? false as const : { duration: 700, easing: "easeOutQuart" as const },
    indexAxis: horizontal ? "y" as const : "x" as const,
    interaction: { mode: kind === "bar" ? "nearest" as const : "index" as const, axis: kind === "bar" ? "xy" as const : horizontal ? "y" as const : "x" as const, intersect: kind === "bar" },
    plugins: {
      legend: { display: showLegend && (series.length > 1 || Boolean(series[0]?.color)), position: "bottom" as const, labels: { font: chartFont, color: "#475569", boxWidth: 10, boxHeight: 10, padding: 16, usePointStyle:refined, pointStyle:"circle" as const } },
      tooltip: { enabled: !modern, external: modern ? ({ tooltip }) => {
        if (!tooltip.opacity) { scheduleClose(); return; }
        cancelClose(); setActiveIndex(tooltip.dataPoints?.[0]?.dataIndex ?? null); setActiveDataset(tooltip.dataPoints?.[0]?.datasetIndex ?? 0);
      } : undefined, bodyFont: chartFont, titleFont: chartFont, backgroundColor: "#FFFFFF", titleColor: "#203264", bodyColor: "#64748B", borderColor: "#E2E8F0", borderWidth: 1, cornerRadius:12, padding:12, callbacks: {
        title: (items: { dataIndex: number }[]) => labels[items[0]?.dataIndex] ?? "",
        label: (item: { dataIndex: number; datasetIndex: number }) => `${series[item.datasetIndex].label}: ${formatValue(series[item.datasetIndex].values[item.dataIndex])}`,
      } },
    },
    scales: { x: horizontal ? numericAxis : categoryAxis, y: horizontal ? categoryAxis : numericAxis },
  } satisfies ChartOptions<"line" | "bar">;

  const doughnutData = {labels, datasets:[{label:series[0]?.label ?? "Records",data:coordinates[0] ?? [],backgroundColor:categoryColors ?? COLORS,hoverBackgroundColor:categoryColors ?? COLORS,borderColor:refined || modern?"#FFFFFF":"#64748B",hoverBorderColor:refined || modern?"#FFFFFF":"#64748B",borderWidth:refined || modern?3:1,borderRadius:modern?5:0,spacing:modern?2:0,hoverOffset:refined || modern?3:0}]};
  const doughnutOptions: ChartOptions<"doughnut"> = {responsive:true,maintainAspectRatio:false,animation:reduceMotion?false:{duration:800,easing:"easeOutQuart",animateRotate:true,animateScale:true},cutout:cutout ?? (refined?"80%":modern?"78%":"72%"),
    plugins:{legend:{display:showLegend,position:"bottom",labels:{font:chartFont,color:"#475569",boxWidth:10,padding:14,usePointStyle:refined || modern,pointStyle:"circle"}},tooltip:{enabled:!modern,external:modern?({tooltip})=>{
      if(!tooltip.opacity){scheduleClose();return;}cancelClose();setActiveIndex(tooltip.dataPoints?.[0]?.dataIndex??null);
    }:undefined,bodyFont:chartFont,titleFont:chartFont,backgroundColor:"#FFFFFF",titleColor:"#203264",bodyColor:"#64748B",borderColor:"#E2E8F0",borderWidth:1,cornerRadius:12,padding:12,callbacks:{label:item=>`${item.label}: ${formatReportNumber(Number(item.raw),0)} ${valueUnit}`}}}};
  const scaleControls = (<div className={`${compactHeader ? "" : "mb-2"} flex flex-wrap items-center justify-between gap-x-3 gap-y-1`}>
        <p role="status" className="text-xs text-slate-500">Scale: 0–{money ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(scale.max) : formatReportNumber(scale.max, 0)}</p>
        <Button type="button" variant="ghost" size="sm" className="h-auto px-1 py-1 text-xs text-[#365FA6]" onClick={scale.fit} aria-label={`Fit ${title} scale to current data`}>Fit current data</Button>
      </div>);
  return <Card className={`min-w-0 ${refined?"rounded-2xl border-slate-100 shadow-sm":""} ${className}`}>
    <CardHeader className={compactHeader ? "p-4 pb-1" : "p-4 pb-2"}><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><CardTitle><h3 id={`${id}-title`} className="text-base leading-snug">{title}</h3></CardTitle>{headerActions}</div>
      {description && <p className="text-xs leading-relaxed text-slate-500">{description}</p>}
    </CardHeader>
    <CardContent className="p-4 pb-0 pt-0">
      {stableScale && !compactHeader && scaleControls}
      {!hasData ? <div style={plotHeight ? { minHeight: plotHeight } : undefined}><EmptyState title="No chart activity" description={emptyMessage} className={plotHeight ? "min-h-0 px-3 py-4" : compact ? "min-h-44 px-3 py-4" : "min-h-48 px-3 py-5"} /></div> : <>
        <div ref={chartWrapper} role={modern ? "group" : undefined} tabIndex={modern ? 0 : undefined} aria-label={modern ? `${title}. Use Left and Right arrow keys to browse${kind === "bar" && series.length > 1 ? ", Up and Down to change series" : ""}, Escape to close the tooltip.` : undefined} aria-describedby={modern && tooltipIndex !== null ? `${id}-tooltip` : undefined}
          onPointerMove={modern ? followPointer : undefined} onPointerDown={modern ? followPointer : undefined}
          onFocus={modern ? () => {cancelClose();setActiveDataset(0);setActiveIndex(labels.length-1);} : undefined}
          onBlur={modern ? event => {if(!event.currentTarget.contains(event.relatedTarget)){cancelClose();setTooltipPosition(null);setActiveIndex(null);}} : undefined}
          onKeyDown={modern ? event => {
            if(event.key==="Escape"){cancelClose();setActiveIndex(null);return;}
            if(kind === "bar" && ["ArrowUp","ArrowDown"].includes(event.key)) {
              event.preventDefault();cancelClose();setTooltipPosition(null);setActiveIndex(tooltipIndex??labels.length-1);
              setActiveDataset(value => Math.max(0,Math.min(series.length-1,value+(event.key==="ArrowUp"?-1:1))));return;
            }
            if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
            event.preventDefault();cancelClose();setTooltipPosition(null);setActiveIndex(event.key==="Home"?0:event.key==="End"?labels.length-1:Math.max(0,Math.min(labels.length-1,(tooltipIndex??labels.length-1)+(event.key==="ArrowLeft"?-1:1))));
          } : undefined}
          className={`dashboard-chart-enter relative w-full min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] ${refined?"px-1 pt-3":""}`} style={{ height: plotHeight ?? (compact ? 176 : horizontal ? Math.min(360, Math.max(192, labels.length * 30)) : 192) }}>
          {kind === "doughnut" ? <>
            <Doughnut data={doughnutData} options={doughnutOptions} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} />
            {centerValue !== undefined && <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2 text-center"><AnimatedNumber as="p" className="text-2xl font-semibold tabular-nums text-[#203264]" value={typeof centerValue === "number" ? formatReportNumber(centerValue,0) : centerValue} /><p className="text-xs text-slate-500">{centerLabel}</p></div>}
          </> : kind === "line" ? <Line data={data} options={options} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} /> :
            <Bar data={data} options={options} plugins={[barValueLabels]} role="img" aria-labelledby={`${id}-title`} fallbackContent={title} />}
          {modern && tooltipIndex !== null && <div ref={tooltipElement} id={`${id}-tooltip`} role="tooltip" onPointerEnter={cancelClose} onPointerLeave={scheduleClose}
            style={tooltipPosition ?? {right:0,top:0}}
            className="absolute z-50 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
            <p className="font-semibold text-[#203264]">{labels[tooltipIndex]}</p>
            {series.map((item,index) => ({item,index})).filter(({index}) => kind === "doughnut" ? index === 0 : kind === "bar" ? index === Math.min(activeDataset,series.length-1) : true).map(({item,index}) => {
              const value = item.values[tooltipIndex] ?? null;
              const prior = tooltipIndex > 0 && kind === "line" ? item.values[tooltipIndex-1] : null;
              const difference = typeof value === "number" && typeof prior === "number" ? value - prior : null;
              const total = kind === "doughnut" ? coordinates[0].reduce<number>((sum,value) => sum+(value??0),0) : 0;
              return <div key={item.label} className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                <p className="flex justify-between gap-3"><span>{kind === "doughnut" ? valueUnit : item.label}</span><strong className="tabular-nums" style={{color:kind === "doughnut" || (kind === "bar" && series.length === 1 && categoryColors) ? (categoryColors ?? COLORS)[tooltipIndex] : colors[index]}}>{formatValue(value)}</strong></p>
                {kind === "doughnut" && total > 0 && typeof value === "number" && <p className="text-slate-500">{formatReportNumber(value/total*100,1)}% of {valueUnit}</p>}
                {prior !== null && prior !== undefined && <>
                  <p className="flex justify-between gap-3 text-slate-500"><span>Previous point · {labels[tooltipIndex-1]}</span><strong className="tabular-nums">{formatValue(prior)}</strong></p>
                  {difference !== null && <p className={`font-semibold tabular-nums ${difference>0?"text-emerald-700":difference<0?"text-red-700":"text-slate-500"}`}>{difference>0?"+":""}{formatReportNumber(difference)} vs previous point</p>}
                </>}
              </div>;
            })}
          </div>}
        </div>
        {relativeMoney && <p className="mt-2 text-xs text-slate-500">Relative to the largest amount. Hover or view data for exact peso values.</p>}
      </>}
      {labels.length > 0 && <div className="mt-3 text-xs text-slate-600">
        <AnimatedDisclosure actions={compactHeader && stableScale ? scaleControls : undefined} trigger={<span className="inline-flex items-center gap-2 px-2 font-medium text-[#365FA6]">View chart data<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform duration-300 group-data-[state=open]/services:rotate-180" /></span>}>
        <div className="max-h-72 overflow-y-auto">
          <Table><caption className="sr-only">{title} data</caption>
            <TableHeader><TableRow><TableHead scope="col">Period / Category</TableHead>{series.map((item) => <TableHead key={item.label} scope="col" className="text-right">{item.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{labels.map((label, index) => <TableRow key={`${label}-${index}`}>
              <TableHead scope="row" className="normal-case tracking-normal">{label}</TableHead>
              {series.map((item) => <TableCell key={item.label} className="whitespace-nowrap text-right tabular-nums">{formatValue(item.values[index])}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </div>
        </AnimatedDisclosure>
      </div>}
    </CardContent>
  </Card>;
}
