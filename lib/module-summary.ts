import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { manilaDate } from "@/lib/inactivity/calculate";
import type { ModuleSummary, ModuleKind } from "@/components/module-summary";

/** Call only after module view permission and branch scope have been resolved. */
export async function loadModuleSummary(admin: ReturnType<typeof createAdminClient>, module: ModuleKind, branchIds: string[]): Promise<ModuleSummary> {
  const to = manilaDate(new Date());
  const end = new Date(`${to.slice(0,7)}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() - (module === "baptisms" ? 11 : 5));
  const from = end.toISOString().slice(0,10);
  if (!branchIds.length) return { module, from, to, totals: [], trend: [], breakdown: [] };
  const { data, error } = await admin.rpc("get_module_summary", {p_module: module, p_branch_ids: branchIds, p_from: from, p_to: to});
  if (error) throw new Error("Unable to load module summary.");
  return { ...data, module, from, to } as ModuleSummary;
}
