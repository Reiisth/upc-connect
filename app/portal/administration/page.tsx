import { Suspense } from "react";
import {
  Building2,
  Network,
  CalendarDays,
  SlidersHorizontal,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { hasPermission } from "@/lib/permissions";
import { getAdministrationHubPermissions } from "./access";

import { ClickableCard } from "@/components/ui/clickable-card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdministrationPage() {
  return (
    <Suspense fallback={<AdministrationLoading />}>
      <AdministrationContent />
    </Suspense>
  );
}

async function AdministrationContent() {
  const permissions = await getAdministrationHubPermissions();

  const canViewBranches = hasPermission(
    permissions,
    "branches.view",
  );
  const canViewRoles = hasPermission(
    permissions,
    "roles.view",
  );
  const canViewDepartments = hasPermission(permissions, "departments.view") ||
    hasPermission(permissions, "departments.manage");
  const canViewServiceTypes = hasPermission(permissions, "service_types.view") || hasPermission(permissions, "service_types.manage");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="System Management"
        eyebrowIcon={<Settings className="h-4 w-4" />}
        title="Administration"
        description="Manage system-wide settings, church branches, and staff access."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {canViewBranches && (
          <ClickableCard href="/portal/administration/branches">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-[#203264]">
                  Church Branches
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  View, create, edit, and manage church branches.
                </p>
              </div>
            </div>
          </ClickableCard>
        )}

        {canViewRoles && (
          <ClickableCard href="/portal/administration/roles">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-[#203264]">
                  Roles &amp; Permissions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review role metadata and manage permission access.
                </p>
              </div>
            </div>
          </ClickableCard>
        )}

        {canViewDepartments && (
          <ClickableCard href="/portal/administration/departments">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]"><Network className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-[#203264]">Church Departments</h2>
                <p className="mt-1 text-sm text-slate-500">View and manage the church-wide department list.</p>
              </div>
            </div>
          </ClickableCard>
        )}

        {canViewServiceTypes && <ClickableCard href="/portal/administration/service-types"><div className="flex items-start gap-4"><div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]"><CalendarDays className="h-5 w-5" /></div><div><h2 className="font-semibold text-[#203264]">Service Types</h2><p className="mt-1 text-sm text-slate-500">Manage global service type names and availability.</p></div></div></ClickableCard>}

        {hasPermission(permissions, "administration.view") && (
          <ClickableCard href="/portal/administration/profile-fields">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264]">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[#203264]">Profile Fields</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure the fields used in member profiles.
                </p>
              </div>
            </div>
          </ClickableCard>
        )}
      </div>
    </PageContainer>
  );
}

function AdministrationLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </PageContainer>
  );
}
