import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function EvangelismPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="evangelism_officer" title="Evangelism Portal">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
