import { redirect } from "next/navigation";

/** Preserve the legacy URL while routing branch-access work to Accounts. */
export default function StaffBranchAccessPage() {
  redirect("/portal/accounts/staff");
}
