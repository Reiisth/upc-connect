export type AttendanceCounts = {present:number;excused:number;absent:number};
export type AttendanceDashboardData = {
 branchId:string|null; date:string|null; from:string; to:string;
 latest:({id:string;name:string;serviceDate:string;branchName:string}&AttendanceCounts)|null;
 average:number|null; qualifyingServices:number; totalMembers:number;
 trend:{period:string;present:number}[];
 byBranch:({id:string;name:string}&AttendanceCounts)[];
};
export function attendanceChartMode(date:string|null,branchId:string|null) {
 return !date ? "line" : branchId ? "doughnut" : "stacked";
}
