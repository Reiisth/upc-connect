import { type ReactNode } from "react";
import { RolePortalLayout } from "@/components/staff/role-portal-layout";

export default function AdminPortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RolePortalLayout
      role="system_admin"
      title="System Administration"
    >
      {children}
    </RolePortalLayout>
  );
}
