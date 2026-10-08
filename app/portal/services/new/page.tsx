import { Suspense } from "react";
import { CalendarPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { createService } from "../actions";
import {
  canManageServices,
  getAccessibleActiveBranches,
  requireServicesAccess,
} from "../access";
import { ServiceForm } from "../ServiceForm";

export default function NewServicePage() {
  return (
    <Suspense fallback={<NewServiceLoading />}>
      <NewServiceContent />
    </Suspense>
  );
}

async function NewServiceContent() {
  const access = await requireServicesAccess();

  if (!canManageServices(access)) {
    return (
      <PageContainer>
        <PageHeader
          backHref="/portal/services"
          backLabel="Back to Services"
          eyebrow="Attendance Operations"
          eyebrowIcon={<CalendarPlus className="h-4 w-4" />}
          title="New Service"
          description="Create a service schedule for an assigned branch."
        />

        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" />}
          title="View-only access"
          description="Only pastors can create or edit services."
        />
      </PageContainer>
    );
  }

  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/services"
        backLabel="Back to Services"
        eyebrow="Attendance Operations"
        eyebrowIcon={<CalendarPlus className="h-4 w-4" />}
        title="New Service"
        description="Create a service schedule for an assigned active branch."
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" />}
          title="No active branches available"
          description="You need an assigned active church branch before creating a service."
        />
      ) : (
        <ServiceForm
          branches={branches}
          action={createService}
          submitLabel="Create Service"
        />
      )}
    </PageContainer>
  );
}

function NewServiceLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-[520px] rounded-2xl" />
    </PageContainer>
  );
}
