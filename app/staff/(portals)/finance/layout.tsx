import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function FinancePortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="accounting_officer" title="Finance Portal">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
