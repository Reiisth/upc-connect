"use client";
import { ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { contributionTicker } from "@/lib/contribution-comparison";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import ReportChart from "@/app/portal/reports/ReportChart";
import { formatReportMoney, formatReportNumber } from "@/app/portal/reports/presentation";

export type ModuleKind = "attendance" | "baptisms" | "contributions";
type Value = number | string | null;
export type ModuleSummary = {
  module: ModuleKind; from: string; to: string;
  comparison?: {from:string;to:string;totals:ModuleSummary["totals"]};
  totals: ({ branchId: string | null } & Record<string, Value>)[];
  trend: { branchId: string | null; period: string; value: Value }[];
  breakdown: { branchId: string | null; label: string; value: Value }[];
};

export default function ModuleMiniDashboard({ data, branchId, branchName }: { data: ModuleSummary; branchId: string; branchName: string }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const id = branchId === "all" ? null : branchId;
  const total = data.totals.find(row => row.branchId === id);
  const number = (key: string) => formatReportNumber(typeof total?.[key] === "number" ? total[key] as number : key === "average" ? null : 0);
  const money = (key: string) => formatReportMoney(typeof total?.[key] === "string" ? total[key] as string : key === "average" ? null : "0.00");
  const isMoney = data.module === "contributions";
  const metrics = data.module === "attendance" ? [
    ["Attendance Records", number("count")], ["Physical Check-ins", number("physical")], ["Average / Completed Service", number("average")],
  ] : data.module === "baptisms" ? [
    ["Dated Baptism Records", number("count")], ["Water Records", number("water")], ["Holy Ghost Records", number("holyGhost")],
  ] : [["Total Received", money("amount")], ["Contribution Records", number("count")], ["Average Contribution", money("average")]];
  const months: string[] = [];
  const month = new Date(`${data.from.slice(0,7)}-01T00:00:00Z`);
  const monthCount=isMoney?(Number(data.to.slice(0,4))-Number(data.from.slice(0,4)))*12+Number(data.to.slice(5,7))-Number(data.from.slice(5,7))+1:data.module==="baptisms"?12:6;
  for (let i=0;i<monthCount;i++) { months.push(`${month.toISOString().slice(0,7)}-01`); month.setUTCMonth(month.getUTCMonth()+1); }
  const points = data.trend.filter(row => row.branchId === id);
  const labels = months.map(date => new Intl.DateTimeFormat("en-PH", {month:"short",...(isMoney&&data.from.slice(0,4)!==data.to.slice(0,4)?{year:"2-digit" as const}:{}),timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`)));
  const names: Record<string,string> = {present:"Present",absent:"Absent",excused:"Excused",water:"Water",holy_ghost:"Holy Ghost",member:"Member",visitor:"Visitor",anonymous:"Anonymous"};
  const categories = data.module === "attendance" ? ["present","excused","absent"] : data.module === "baptisms" ? ["water","holy_ghost"] : ["member","visitor","anonymous"];
  const title = data.module === "attendance" ? "Physical Attendance Trend" : data.module === "baptisms" ? "Baptisms Over Time" : "Contributions Over Time";
  const breakdownTitle = data.module === "attendance" ? "Recorded Attendance Status" : data.module === "baptisms" ? "Baptism Records by Type" : "Amount by Contributor Type";
  const previous=data.comparison?.totals.find(row=>row.branchId===id);
  return <section aria-label="Module mini dashboard" className="space-y-3">
    <p className="text-xs text-slate-500">{branchName} · {data.from} to {data.to}{isMoney?" · Selected date range":" · Last "+(data.module === "baptisms" ? 12 : 6)+" calendar months, through today. Other filters below apply to the table only."}</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{metrics.map(([label,value],index) => <Card key={label} className={`min-w-0 ${isMoney&&label==="Total Received"?"col-span-2 lg:col-span-1":""}`}><CardContent className="p-3 sm:p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 break-words ${isMoney?"text-2xl sm:text-3xl":"text-xl"} font-semibold tabular-nums text-[#203264]`}>{value}</p>{isMoney&&<ContributionComparison current={total?.[["amount","count","average"][index]]??(index===2?null:"0")} previous={Number(previous?.count??0)>0?previous?.[["amount","count","average"][index]]??null:null} context={data.comparison?`${data.comparison.from} to ${data.comparison.to}`:undefined}/>}</CardContent></Card>)}</div>
    {data.module === "baptisms" && <p className="text-xs text-slate-500">{number("undated")} undated records in this branch scope are excluded from the dated period. Types count records, not distinct people.</p>}
    <div className="grid min-w-0 gap-3 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2"><ReportChart compact title={title} kind={data.module === "attendance" ? "line" : "bar"} money={isMoney} moneyScale={isMoney?"absolute":"relative"} labels={labels}
        series={[{label:isMoney ? "Amount Received" : data.module === "attendance" ? "Physical Check-ins" : "Baptism Records",values:months.map(period => points.find(row => row.period === period)?.value ?? (isMoney ? "0.00" : 0))}]}
        description={data.module === "attendance" ? "Completed Services only. Present only; includes visiting and inactive Members." : "Monthly totals in the period above."}
        emptyMessage={`No ${data.module === "attendance" ? "physical attendance" : data.module} data for this period.`} /></div>
      <div className="min-w-0"><button type="button" className="text-xs font-medium text-[#365FA6] lg:hidden" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>{showBreakdown ? "Hide" : "Show"} {breakdownTitle}</button>
        <div className={`${showBreakdown ? "block" : "hidden"} mt-2 lg:mt-0 lg:block`}><ReportChart compact title={breakdownTitle} horizontal money={isMoney} moneyScale={isMoney?"absolute":"relative"} labels={categories.map(key=>names[key])}
          series={[{label:isMoney ? "Amount Received" : "Records", values:categories.map(label => data.breakdown.find(row=>row.branchId===id && row.label===label)?.value ?? (isMoney ? "0.00" : 0))}]}
          emptyMessage="No records for this period." /></div>
      </div>
    </div>
  </section>;
}

function ContributionComparison({current,previous,context}:{current:Value;previous:Value;context?:string}){
 const ticker=contributionTicker(current,previous),Icon=ticker.direction==="up"?ArrowUpRight:ticker.direction==="down"?ArrowDownRight:ArrowRight;
 return <p title={context?`Compared with ${context}`:undefined} aria-label={`Contribution comparison: ${ticker.percent?`${ticker.direction} ${ticker.percent} ${ticker.label}`:ticker.label}`} className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${ticker.direction==="up"?"text-emerald-700":ticker.direction==="down"?"text-rose-700":"text-slate-500"}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{ticker.percent?`${ticker.percent} ${ticker.label}`:ticker.label}</p>;
}
