import { Suspense, type ReactNode } from "react";
import { RolePortalLayout, RolePortalLoading } from "@/components/staff/role-portal-layout";

export default function SpiritualMinistryPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<RolePortalLoading />}>
      <RolePortalLayout role="spiritual_ministry_officer" title="Spiritual Ministry Portal">
        {children}
      </RolePortalLayout>
    </Suspense>
  );
}
