import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function UsherPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="usher" title="Usher Portal">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
