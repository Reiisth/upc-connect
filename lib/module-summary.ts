import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAnalyticsDateRange, validAnalyticsDate } from "@/lib/analytics/date-range";
import { manilaDate } from "@/lib/inactivity/calculate";
import type { ModuleSummary, ModuleKind } from "@/components/module-summary";

/** Call only after module view permission and branch scope have been resolved. */
export async function loadModuleSummary(admin: ReturnType<typeof createAdminClient>, module: ModuleKind, branchIds: string[], range?: {from:string;to:string}): Promise<ModuleSummary> {
  let to = manilaDate(new Date());
  const end = new Date(`${to.slice(0,7)}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() - (module === "baptisms" ? 11 : 5));
  let from = end.toISOString().slice(0,10);
  if(range){({from,to}=resolveAnalyticsDateRange({preset:"custom",...range}));}
  if (!branchIds.length) return { module, from, to, totals: [], trend: [], breakdown: [] };
  const { data, error } = await admin.rpc(module==="baptisms"?"get_baptism_module_summary":"get_module_summary", {...(module==="baptisms"?{}:{p_module:module}),p_branch_ids: branchIds, p_from: from, p_to: to});
  if (error) throw new Error("Unable to load module summary.");
  let comparison: ModuleSummary["comparison"];
  if(module==="contributions"||module==="baptisms"){
    const duration=Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`)+86400000;
    const previousTo=new Date(Date.parse(`${from}T00:00:00Z`)-86400000).toISOString().slice(0,10);
    const previousFrom=new Date(Date.parse(`${from}T00:00:00Z`)-duration).toISOString().slice(0,10);
    const previous=validAnalyticsDate(previousFrom)&&validAnalyticsDate(previousTo)?await admin.rpc("get_module_summary",{p_module:module,p_branch_ids:branchIds,p_from:previousFrom,p_to:previousTo}):{data:{totals:[]},error:null};
    if(previous.error)throw new Error("Unable to load module comparison.");
    comparison={from:previousFrom,to:previousTo,totals:previous.data.totals};
  }
  return { ...data, module, from, to, comparison } as ModuleSummary;
}
