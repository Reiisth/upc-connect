import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function PastorPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="pastor" title="Pastor Portal">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
