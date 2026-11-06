import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/read-all-pages";
import { manilaDate } from "@/lib/inactivity/calculate";
import { validAnalyticsDate } from "@/lib/analytics/date-range";
import { effectiveStoredServiceStatus } from "@/app/portal/services/lifecycle";
import { attendanceComparison, type AttendanceCounts, type AttendanceDashboardData } from "./attendance-dashboard-model";

type Branch = {id:string;name:string};
type Service = {id:string;name:string;church_branch_id:string;service_date:string;start_time:string|null;status:string};
const statuses = ["present","excused","absent"] as const;

/** Branches must come from attendance.view + existing active host-branch scope. */
export async function loadAttendanceDashboard(admin:ReturnType<typeof createAdminClient>,branches:Branch[],branchId:string|null=null,date:string|null=null,now=new Date()):Promise<AttendanceDashboardData> {
 if (date && !validAnalyticsDate(date)) throw new Error("Select a valid dashboard calendar date.");
 if (branchId && !branches.some(branch=>branch.id===branchId)) throw new Error("Dashboard branch is outside your access.");
 const scoped=branchId ? branches.filter(branch=>branch.id===branchId):branches;
 const ids=scoped.map(branch=>branch.id);
 const today=manilaDate(now),start=new Date(`${today.slice(0,7)}-01T00:00:00Z`);start.setUTCMonth(start.getUTCMonth()-5);
 const from=date||start.toISOString().slice(0,10),to=date||today;
 const result:AttendanceDashboardData={branchId,date,from,to,latest:null,average:null,qualifyingServices:0,totalMembers:0,trend:[],byBranch:[]};
 if(!ids.length)return result;
 try {
   // SQL COUNT only: no attendance/member profiles are downloaded for aggregation.
   async function count(serviceIds:string[],status:typeof statuses[number]) {
     let total=0;
     for(let offset=0;offset<serviceIds.length;offset+=100){
       const response=await admin.from("attendance_records").select("id",{count:"exact",head:true}).in("service_id",serviceIds.slice(offset,offset+100)).eq("attendance_status",status);
       if(response.error || typeof response.count!=="number")throw new Error("Count unavailable");total+=response.count;
     }
     return total;
   }
   async function counts(serviceIds:string[]):Promise<AttendanceCounts>{const values=await Promise.all(statuses.map(status=>count(serviceIds,status)));return {present:values[0],excused:values[1],absent:values[2]};}
   const [memberCount,rows] = await Promise.all([
     admin.from("members").select("id",{count:"exact",head:true}).in("church_branch_id",ids).eq("is_archived",false),
     readAllPages((first,last)=>admin.from("services").select("id,name,church_branch_id,service_date,start_time,status")
       .in("church_branch_id",ids).in("status",["scheduled","ongoing","completed"]).gte("service_date",from).lte("service_date",to).order("id").range(first,last)),
   ]);
   if(memberCount.error || typeof memberCount.count!=="number")throw new Error("Member count unavailable");
   result.totalMembers=memberCount.count;
   const services=(rows as Service[]).filter(service=>effectiveStoredServiceStatus(service,now)!=="scheduled");
   result.qualifyingServices=services.length;
   if(date){
     result.byBranch=await Promise.all(scoped.map(async branch=>({...branch,...await counts(services.filter(service=>service.church_branch_id===branch.id).map(service=>service.id))})));
   }else{
     const months: string[]=[];const cursor=new Date(`${from}T00:00:00Z`);
     for(let index=0;index<6;index++){months.push(cursor.toISOString().slice(0,10));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
     result.trend=await Promise.all(months.map(async period=>({period,present:await count(services.filter(service=>service.service_date.slice(0,7)===period.slice(0,7)).map(service=>service.id),"present")})));
   }
   const present=date?result.byBranch.reduce((sum,branch)=>sum+branch.present,0):result.trend.reduce((sum,point)=>sum+point.present,0);
   result.average=services.length ? Math.round(present/services.length*100)/100:null;
   // Compare unrounded Present-per-Service values across adjacent equal-day ranges.
   const days=Math.round((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000)+1;
   const previousTo=new Date(Date.parse(`${from}T00:00:00Z`)-86400000).toISOString().slice(0,10);
   const previousFrom=new Date(Date.parse(`${from}T00:00:00Z`)-days*86400000).toISOString().slice(0,10);
   const previousRows=await readAllPages((first,last)=>admin.from("services").select("id,name,church_branch_id,service_date,start_time,status")
     .in("church_branch_id",ids).in("status",["scheduled","ongoing","completed"]).gte("service_date",previousFrom).lte("service_date",previousTo).order("id").range(first,last));
   const previousServices=(previousRows as Service[]).filter(service=>effectiveStoredServiceStatus(service,now)!=="scheduled");
   const previousPresent=await count(previousServices.map(service=>service.id),"present");
   result.averageComparison=attendanceComparison(services.length?present/services.length:null,previousServices.length?previousPresent/previousServices.length:null,
     date?"vs previous day":`vs previous ${days} days`);
   // Parent !inner selects only attendance-bearing Services. Each parent embeds
   // at most ONE opaque row ID to establish existence, never a roster/history.
   // Page candidates so future starts today cannot hide an older valid Service.
   const latestServices:Service[]=[];
   for(let offset=0;;offset+=20){
     let query=admin.from("services").select("id,name,church_branch_id,service_date,start_time,status,attendance_records!inner(id)")
       .in("church_branch_id",ids).in("status",["scheduled","ongoing","completed"]);
     query=query.lte("service_date",date??today);
     const response=await query.order("service_date",{ascending:false}).order("start_time",{ascending:false,nullsFirst:false}).order("id",{ascending:false})
       .limit(1,{referencedTable:"attendance_records"}).range(offset,offset+19);
     if(response.error)throw new Error("Latest Service unavailable");
     const candidates=(response.data??[]) as unknown as Service[];
     latestServices.push(...candidates.filter(service=>effectiveStoredServiceStatus(service,now)!=="scheduled").slice(0,2-latestServices.length));
     if(latestServices.length===2)break;
     if(candidates.length<20)break;
   }
   const latest=latestServices[0];
   if(latest&&(!date||latest.service_date===date)){
     const latestCounts=await counts([latest.id]);
     result.latest={id:latest.id,name:latest.name,serviceDate:latest.service_date,branchName:scoped.find(branch=>branch.id===latest.church_branch_id)?.name??"Host branch",...latestCounts};
     const previous=latestServices[1]?await counts([latestServices[1].id]):null;
     result.latestComparison=attendanceComparison(latestCounts.present+latestCounts.excused+latestCounts.absent,previous?previous.present+previous.excused+previous.absent:null,"vs previous service");
   }else result.latestComparison=attendanceComparison(null,null,"vs previous service");
   return result;
 }catch{throw new Error("Unable to load Attendance dashboard. Try again.");}
}
