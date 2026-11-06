"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReportChart from "@/app/portal/reports/ReportChart";
import { formatReportNumber } from "@/app/portal/reports/presentation";
import { ATTENDANCE_COLORS, attendanceChartMode, type AttendanceComparison, type AttendanceDashboardData } from "@/lib/attendance-dashboard-model";
import { refreshAttendanceDashboard } from "./dashboard-actions";

type Props={initial:AttendanceDashboardData;branches:{id:string;name:string}[];branchFilter:string;onBranchChange:(value:string)=>void};
export default function AttendanceMiniDashboard({initial,branches,branchFilter,onBranchChange}:Props){
 const [date,setDate]=useState("");const [data,setData]=useState(initial);const [error,setError]=useState("");const [retry,setRetry]=useState(0);const sequence=useRef(0);const seed=useRef(initial);
 const branchId=branchFilter==="all"?null:branchFilter,selectedDate=date||null;
 useEffect(()=>{
   const request=++sequence.current;const refreshed=seed.current!==initial;seed.current=initial;
   setError("");
   if(refreshed && initial.branchId===branchId && initial.date===selectedDate){setData(initial);return;}
   if(!refreshed&&data.branchId===branchId&&data.date===selectedDate&&!retry)return;
   let active=true;
   refreshAttendanceDashboard(branchId,selectedDate).then(value=>{if(active&&sequence.current===request)setData(value);})
     .catch(()=>{if(active&&sequence.current===request)setError("Unable to load this dashboard context. Try again.");});
   return ()=>{active=false;};
   // Data is a response, not a filter dependency; avoid refetch loops.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[branchId,selectedDate,retry,initial]);
 const current=data.branchId===branchId&&data.date===selectedDate;
 const latest=data.latest,mode=attendanceChartMode(selectedDate,branchId,branchId?1:branches.length);
 const present=latest?.present??null;
 const branchName=!branchId&&branches.length===1?branches[0].name:branchId?branches.find(branch=>branch.id===branchId)?.name??"Selected branch":"All authorized branches";
 const metrics=[
   {comparison:data.latestComparison,label:"Latest Service Attendance",value:formatReportNumber(present,0),note:latest?`${latest.name} · ${latest.serviceDate}`:"No Service with attendance records."},
   {comparison:data.averageComparison,label:"Average Attendance",value:formatReportNumber(data.average),note:null},
   {label:"Total Members",value:formatReportNumber(data.totalMembers,0),note:null},
 ];
 const counts=data.byBranch[0];
 const dayTotal=data.byBranch.reduce((sum,row)=>sum+row.present+row.excused+row.absent,0);
 return <section aria-label="Attendance mini dashboard" className="space-y-3">
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap">
   <FormField label="Branch" htmlFor="dashboard-branch" className="col-span-2 min-w-0 sm:flex-1 sm:max-w-xs"><Select id="dashboard-branch" aria-label="Filter attendance by branch" value={branchFilter} onChange={e=>onBranchChange(e.target.value)}><option value="all">All authorized branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></FormField>
   <FormField label="Dashboard Date" htmlFor="attendance-dashboard-date" className={`min-w-0 sm:flex-1 sm:max-w-[190px] ${date ? "" : "col-span-2"}`}><Input id="attendance-dashboard-date" aria-label="Attendance dashboard date" type="date" value={date} onChange={e=>setDate(e.target.value)} /></FormField>
   {date&&<Button variant="outline" type="button" onClick={()=>setDate("")}>Clear date</Button>}
  </div>

  {error?<div role="alert" className="flex items-center gap-3 text-sm text-red-700">{error}<Button variant="outline" onClick={()=>setRetry(value=>value+1)}>Retry</Button></div>:!current?<div role="status" aria-label="Updating Attendance dashboard"><Skeleton className="h-24 w-full"/><Skeleton className="mt-3 h-[260px] w-full"/></div>:<>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{metrics.map(metric=><Card key={metric.label} className={`min-w-0 ${metric.label === "Latest Service Attendance" ? "col-span-2 sm:col-span-1" : ""}`}><CardContent className="p-3 sm:p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl text-[#203264]">{metric.value}</p>{metric.label!=="Total Members"&&<ComparisonTicker comparison={metric.comparison}/>}{metric.note&&<p className="mt-2 text-xs text-slate-500">{metric.note}</p>}</CardContent></Card>)}</div>
   {mode==="line"?<ReportChart appearance="attendance" compact kind="line" title="Attendance Trend" description="Recent six calendar months through today · Present records at Ongoing / Completed host Services." labels={data.trend.map(point=>new Intl.DateTimeFormat("en-PH",{month:"short",timeZone:"UTC"}).format(new Date(`${point.period}T00:00:00Z`)))} series={[{label:"Present",color:ATTENDANCE_COLORS.present,values:data.trend.map(point=>point.present)}]} emptyMessage="No Present attendance records in this period."/>:
    mode==="stacked"?<ReportChart appearance="attendance" compact stacked kind="bar" title="Attendance by Branch" description={`Recorded attendance across all qualifying host Services on ${selectedDate}.`} labels={data.byBranch.map(row=>row.name)} series={(["present","excused","absent"] as const).map(status=>({color:ATTENDANCE_COLORS[status],label:status[0].toUpperCase()+status.slice(1),values:data.byBranch.map(row=>row[status])}))} emptyMessage="No attendance records for this date."/>:
    <ReportChart appearance="attendance" compact categoryColors={[ATTENDANCE_COLORS.present,ATTENDANCE_COLORS.excused,ATTENDANCE_COLORS.absent]} kind="doughnut" centerValue={dayTotal} title="Attendance Breakdown" description={`All qualifying Services in ${branchName} on ${selectedDate}. Recorded statuses only.`} labels={["Present","Excused","Absent"]} series={[{label:"Records",values:[counts?.present??0,counts?.excused??0,counts?.absent??0]}]} emptyMessage="No attendance records for this date."/>}
  </>}
 </section>;
}

function ComparisonTicker({comparison}:{comparison?:AttendanceComparison}){
 const percent=comparison?.percent;
 const Icon=percent==null||percent===0?ArrowRight:percent>0?ArrowUpRight:ArrowDownRight;
 const color=percent==null||percent===0?"text-slate-500":percent>0?"text-emerald-700":"text-rose-700";
 return <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${color}`} aria-label={`Attendance comparison: ${percent==null?comparison?.label??"No previous comparison":`${percent>0?"up":percent<0?"down":"unchanged"} ${Math.abs(percent)}% ${comparison?.label}`}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/>{percent==null?comparison?.label??"No previous comparison":`${Math.abs(percent)}% ${comparison?.label}`}</p>;
}
