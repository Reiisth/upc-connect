import { NextResponse } from "next/server";
import { getActiveAccount } from "@/lib/auth";
import { getCurrentUserPermissions } from "@/lib/permissions-server";
import { getUserBranchScope } from "@/lib/branch-access";
import { portalSessionRevision } from "@/lib/portal-session-revision";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const account = await getActiveAccount();
  if (!account) return NextResponse.json({ error: "Session unavailable" }, { status: 401, headers });
  const [permissions, scope] = await Promise.all([getCurrentUserPermissions(account.user.id), getUserBranchScope(account.user.id)]);
  if (!permissions.length) return NextResponse.json({ error: "Access unavailable" }, { status: 403, headers });
  return NextResponse.json({ userId: account.user.id, revision: portalSessionRevision(account.user.id, permissions, scope.branchIds, scope.isSystemAdmin) }, { headers });
}
