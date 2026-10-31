import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Preserve legacy deep links and let the canonical account page authorize the target. */
export default function LegacyStaffBranchAccessPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return <Suspense fallback={null}><LegacyRedirect params={params} /></Suspense>;
}

async function LegacyRedirect({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return redirect(`/portal/accounts/staff/${encodeURIComponent(userId)}`);
}
