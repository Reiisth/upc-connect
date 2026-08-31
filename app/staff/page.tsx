import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { getStaffPortalPath } from "@/lib/staff-roles";

export default function StaffPage() {
  return (
    <Suspense fallback={<p className="p-6">Opening Staff Portal…</p>}>
      <StaffRoleRouter />
    </Suspense>
  );
}

async function StaffRoleRouter() {
  const { staffRole } = await requireStaff();

  return redirect(getStaffPortalPath(staffRole));
}
