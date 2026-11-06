"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReportChart from "@/app/portal/reports/ReportChart";
import { formatReportNumber } from "@/app/portal/reports/presentation";
import { attendanceChartMode, type AttendanceDashboardData } from "@/lib/attendance-dashboard-model";
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
 const latest=data.latest,mode=attendanceChartMode(selectedDate,branchId);
 const total=latest?latest.present+latest.excused+latest.absent:null;
 const branchName=branchId?branches.find(branch=>branch.id===branchId)?.name??"Selected branch":"All authorized branches";
 const metrics=[
   {label:"Latest Service Attendance",value:formatReportNumber(total,0),note:latest?`${latest.name} · ${latest.serviceDate} · ${latest.branchName}. ${latest.present} Present · ${latest.excused} Excused · ${latest.absent} Absent`:"No Service with attendance records in this context."},
   {label:"Average Attendance",value:formatReportNumber(data.average),note:`Present per Service · ${data.qualifyingServices} Ongoing / Completed`},
   {label:"Total Members",value:formatReportNumber(data.totalMembers,0),note:"Current registered members. Home branch, non-archived; date-independent."},
 ];
 const counts=data.byBranch[0];
 const dayTotal=data.byBranch.reduce((sum,row)=>sum+row.present+row.excused+row.absent,0);
 return <section aria-label="Attendance mini dashboard" className="space-y-3">
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap">
   <FormField label="Branch" htmlFor="dashboard-branch" className="col-span-2 min-w-0 sm:flex-1 sm:max-w-xs"><Select id="dashboard-branch" aria-label="Filter attendance by branch" value={branchFilter} onChange={e=>onBranchChange(e.target.value)}><option value="all">All authorized branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></FormField>
   <FormField label="Dashboard Date" htmlFor="attendance-dashboard-date" className={`min-w-0 sm:flex-1 sm:max-w-[190px] ${date ? "" : "col-span-2"}`}><Input id="attendance-dashboard-date" aria-label="Attendance dashboard date" type="date" value={date} onChange={e=>setDate(e.target.value)} /></FormField>
   {date&&<Button variant="outline" type="button" onClick={()=>setDate("")}>Clear date</Button>}
  </div>
  <p className="text-xs text-slate-500">{branchName} · {selectedDate?`${selectedDate} (Asia/Manila)`:`Overview: average and trend ${data.from} to ${data.to}; latest Service through today.`} Dashboard Date does not filter Ongoing / Upcoming lists. Branch scopes both.</p>
  {error?<div role="alert" className="flex items-center gap-3 text-sm text-red-700">{error}<Button variant="outline" onClick={()=>setRetry(value=>value+1)}>Retry</Button></div>:!current?<div role="status" aria-label="Updating Attendance dashboard"><Skeleton className="h-24 w-full"/><Skeleton className="mt-3 h-[260px] w-full"/></div>:<>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{metrics.map(metric=><Card key={metric.label} className={`min-w-0 ${metric.label === "Latest Service Attendance" ? "col-span-2 sm:col-span-1" : ""}`}><CardContent className="p-3 sm:p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-[#203264]">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.note}</p></CardContent></Card>)}</div>
   {mode==="line"?<ReportChart compact kind="line" title="Attendance Trend" description="Recent six calendar months through today · Present records at Ongoing / Completed host Services." labels={data.trend.map(point=>new Intl.DateTimeFormat("en-PH",{month:"short",timeZone:"UTC"}).format(new Date(`${point.period}T00:00:00Z`)))} series={[{label:"Present",values:data.trend.map(point=>point.present)}]} emptyMessage="No Present attendance records in this period."/>:
    mode==="stacked"?<ReportChart compact stacked kind="bar" title="Attendance by Branch" description={`Recorded attendance across all qualifying host Services on ${selectedDate}.`} labels={data.byBranch.map(row=>row.name)} series={(["present","excused","absent"] as const).map(status=>({label:status[0].toUpperCase()+status.slice(1),values:data.byBranch.map(row=>row[status])}))} emptyMessage="No attendance records for this date."/>:
    <ReportChart compact kind="doughnut" centerValue={dayTotal} title="Attendance Breakdown" description={`All qualifying Services in ${branchName} on ${selectedDate}. Recorded statuses only.`} labels={["Present","Excused","Absent"]} series={[{label:"Records",values:[counts?.present??0,counts?.excused??0,counts?.absent??0]}]} emptyMessage="No attendance records for this date."/>}
  </>}
 </section>;
}
