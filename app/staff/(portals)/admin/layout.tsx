import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function AdminPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="system_admin" title="System Administration">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
