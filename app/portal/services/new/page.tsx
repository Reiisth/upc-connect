import { Suspense } from "react";
import { CalendarPlus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import { createService } from "../actions";
import {
  getAccessibleActiveBranches,
  requireServicesPermission,
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
  const access = await requireServicesPermission("services.create");

  const admin = createAdminClient();
  const branches = await getAccessibleActiveBranches(
    access,
    admin,
  );
  const { data: types, error: typesError } = await admin.from("service_types").select("key,name,is_active").eq("is_active", true).order("name");
  if (typesError) throw new Error("Unable to load active service types.");

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
      ) : (types ?? []).length === 0 ? <EmptyState title="No active service types" description="Ask an administrator to activate a service type before creating a service." /> : (
        <ServiceForm
          branches={branches}
          serviceTypes={(types ?? []).map((t) => ({ key: t.key, name: t.name, isActive: t.is_active }))}
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
