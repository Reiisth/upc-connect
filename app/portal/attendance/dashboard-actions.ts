"use server";
import { requireAttendancePermission } from "./access";
import { getAccessibleActiveBranches } from "../services/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAttendanceDashboard } from "@/lib/attendance-dashboard";
export async function refreshAttendanceDashboard(branchId:string|null,date:string|null,filters:{search?:string;type?:string}={}) {
 const access=await requireAttendancePermission("attendance.view");
 const admin=createAdminClient();
 const branches=await getAccessibleActiveBranches(access,admin);
 return loadAttendanceDashboard(admin,branches,branchId,date,new Date(),filters);
}
