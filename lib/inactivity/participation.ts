import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/read-all-pages";

/** Only call with member IDs selected through authorized HOME-branch scope. */
export async function loadPhysicalParticipation(
  admin: ReturnType<typeof createAdminClient>, memberIds: string[], from: string, to: string,
) {
  type Row = {
    id: string; member_id: string; service_id: string; attendance_status: string;
    services: { church_branch_id: string; status: string; service_date: string };
  };
  const rows: Row[] = [];
  for (let offset = 0; offset < memberIds.length; offset += 100) {
    const page = await readAllPages((start, end) => admin.from("attendance_records")
      .select("id, member_id, service_id, attendance_status, services!inner(church_branch_id, status, service_date)")
      .in("member_id", memberIds.slice(offset, offset + 100))
      .eq("services.status", "completed").gte("services.service_date", from).lte("services.service_date", to)
      .eq("attendance_status", "present").order("id").range(start, end));
    rows.push(...page as unknown as Row[]);
  }
  return rows;
}
