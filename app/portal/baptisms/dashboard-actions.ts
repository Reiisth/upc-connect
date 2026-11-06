"use server";
import { requireBaptismPermission } from "./access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";
import { loadModuleSummary } from "@/lib/module-summary";

export async function refreshBaptismSummary(from:string,to:string) {
 const access=await requireBaptismPermission("baptisms.view");
 const admin=createAdminClient();
 const branches=await getHistoricalRecordBranches(access,admin);
 return loadModuleSummary(admin,"baptisms",branches.map(branch=>branch.id),{from,to});
}
