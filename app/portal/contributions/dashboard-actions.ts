"use server";
import { requireContributionsPermission } from "./access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";
import { loadModuleSummary } from "@/lib/module-summary";

export async function refreshContributionSummary(from:string,to:string) {
 const access=await requireContributionsPermission("contributions.view");
 const admin=createAdminClient();
 const branches=await getHistoricalRecordBranches(access,admin);
 return loadModuleSummary(admin,"contributions",branches.map(branch=>branch.id),{from,to});
}
