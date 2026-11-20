import "server-only";
import { getAnalyticsBranchOptions } from "@/lib/analytics/server";
import { getPortalBranchId } from "@/lib/portal-branch-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/read-all-pages";
import { effectiveStoredServiceStatus } from "@/app/portal/services/lifecycle";

export type DashboardServiceOverview = {
  branchName: string;
  branchLocation: string | null;
  branchNames: string[];
  multipleBranches: boolean;
  state: "ongoing" | "scheduled" | "empty" | "unavailable" | "no-access";
  services: {id: string; name: string; serviceType: string; branchName: string; date: string; startTime: string | null}[];
  scheduledTotal: number;
};

/** Dashboard permission permits this minimal, read-only service summary, not service actions. */
export async function getDashboardServiceOverview(now = new Date()): Promise<DashboardServiceOverview> {
  // Auth and branch validation stay outside the recoverable service-query boundary.
  const available = await getAnalyticsBranchOptions();
  const selected = await getPortalBranchId();
  if (selected && !available.some(branch => branch.id === selected)) throw new Error("Dashboard branch is outside your access.");
  const branches = available.filter(branch => !selected || branch.id === selected);
  const base: DashboardServiceOverview = {
    branchName: branches.length === 1 ? branches[0].name : branches.length ? "All branches" : "No branch access",
    branchLocation: null,
    branchNames: branches.map(branch => branch.name), multipleBranches: branches.length > 1,
    state: branches.length ? "empty" : "no-access", services: [], scheduledTotal: 0,
  };
  const ids = branches.filter(branch => branch.isActive).map(branch => branch.id);
  if (!branches.length) return base;
  const admin = createAdminClient();
  const [locationResult,servicesResult] = await Promise.allSettled([
    branches.length === 1 ? admin.from("church_branches")
      .select("street_address,barangay,city,province,country").eq("id",branches[0].id).maybeSingle() : Promise.resolve({data:null,error:null}),
    ids.length ? readAllPages((from,to) => admin.from("services")
      .select("id,name,service_type,church_branch_id,service_date,start_time,status")
      .in("church_branch_id",ids).in("status",["scheduled","ongoing"])
      .order("service_date").order("start_time",{nullsFirst:true}).order("id").range(from,to)) : Promise.resolve([]),
  ]);
  if (locationResult.status === "fulfilled" && !locationResult.value.error && locationResult.value.data) {
    const location = locationResult.value.data;
    base.branchLocation = [location.street_address,location.barangay,location.city,location.province,location.country]
      .map(part => part?.trim()).filter(Boolean).join(", ") || null;
  }
  if (!ids.length) return base;
  if (servicesResult.status === "rejected") return {...base,state:"unavailable"};
  try {
    const rows = servicesResult.value;
    const ongoing = rows.filter(row => effectiveStoredServiceStatus(row,now) === "ongoing");
    const scheduled = rows.filter(row => effectiveStoredServiceStatus(row,now) === "scheduled");
    const services = (ongoing.length ? ongoing : scheduled.slice(0,3)).map(row => ({
      id:row.id,name:row.name,serviceType:row.service_type,branchName:branches.find(branch => branch.id === row.church_branch_id)!.name,
      date:row.service_date,startTime:row.start_time,
    }));
    return {...base,state:ongoing.length ? "ongoing" : scheduled.length ? "scheduled" : "empty",services,scheduledTotal:scheduled.length};
  } catch {
    return {...base,state:"unavailable"};
  }
}
