import { Suspense } from "react";
import { redirect } from "next/navigation";

import { requireAccountsPermission } from "./access";

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsRedirect />
    </Suspense>
  );
}

async function AccountsRedirect() {
  await requireAccountsPermission("accounts.view");
  redirect("/portal/accounts/members");
  return null;
}
