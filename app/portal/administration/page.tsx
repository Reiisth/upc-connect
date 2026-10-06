import { Suspense } from "react";
import {
  Building2,
  Settings,
  UsersRound,
} from "lucide-react";

import { requirePortalTab } from "@/lib/require-portal-tab";

import { ClickableCard } from "@/components/ui/clickable-card";
import { EmptyState } from "@/components/ui/empty-state";
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
  const { roles } = await requirePortalTab("administration");

  if (!roles.includes("system_admin")) {
    return (
      <PageContainer>
        <EmptyState
          title="Access denied"
          description="You do not have permission to access administration settings."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="System Management"
        eyebrowIcon={<Settings className="h-4 w-4" />}
        title="Administration"
        description="Manage system-wide settings, church branches, and staff access."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ClickableCard href="/portal/administration/branches">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264] dark:bg-slate-800 dark:text-slate-200">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-[#203264] dark:text-slate-100">
                Church Branches
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create, edit, activate, and manage church branches.
              </p>
            </div>
          </div>
        </ClickableCard>

        <ClickableCard href="/portal/administration/staff-branch-access">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#EEF3FB] p-3 text-[#203264] dark:bg-slate-800 dark:text-slate-200">
              <UsersRound className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-[#203264] dark:text-slate-100">
                Staff Branch Access
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Assign staff accounts to one or more church branches.
              </p>
            </div>
          </div>
        </ClickableCard>
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
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </PageContainer>
  );
}