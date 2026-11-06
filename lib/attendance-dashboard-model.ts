export type AttendanceCounts = {present:number;excused:number;absent:number};
export type AttendanceDashboardData = {
 branchId:string|null; date:string|null; from:string; to:string;
 latest:({id:string;name:string;serviceDate:string;branchName:string}&AttendanceCounts)|null;
 latestComparison?:AttendanceComparison; averageComparison?:AttendanceComparison;
 average:number|null; qualifyingServices:number; totalMembers:number;
 trend:{period:string;present:number}[];
 byBranch:({id:string;name:string}&AttendanceCounts)[];
};
export function attendanceChartMode(date:string|null,branchId:string|null,effectiveBranchCount=branchId?1:2) {
 return !date ? "line" : effectiveBranchCount===1 ? "doughnut" : "stacked";
}

export const ATTENDANCE_COLORS = {present:"#365FA6",excused:"#8BAFE5",absent:"#CBD5E1"} as const;
export type AttendanceComparison = {previous:number|null;percent:number|null;label:string};
export function attendanceComparison(current:number|null,previous:number|null,label:string):AttendanceComparison {
 if(current===null||previous===null)return {previous,percent:null,label:"No previous comparison"};
 if(previous===0&&current!==0)return {previous,percent:null,label:"Previous value was 0"};
 return {previous,percent:previous===0?0:Math.round((current-previous)/previous*1000)/10,label};
}
