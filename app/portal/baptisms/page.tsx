import { loadModuleSummary } from "@/lib/module-summary";
import Link from "next/link";
import { Suspense } from "react";
import {
  Droplets,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";
import {
  hasAnyPermission,
  hasPermission,
} from "@/lib/permissions";

import {
  BAPTISM_CREATE_PERMISSIONS,
  requireBaptismPermission,
} from "./access";
import BaptismsTable from "./BaptismsTable";
import {
  loadBaptismRecords,
} from "./data";

export default function BaptismsPage() {
  return (
    <Suspense fallback={<BaptismsLoading />}>
      <BaptismsContent />
    </Suspense>
  );
}

async function BaptismsContent() {
  const access = await requireBaptismPermission("baptisms.view");
  const admin = createAdminClient();
  const branches = await getHistoricalRecordBranches(access, admin);
  const records = await loadBaptismRecords(
    admin,
    branches,
  );
  const dashboard = await loadModuleSummary(admin, "baptisms", branches.map(b => b.id));
  const canCreate = hasAnyPermission(
    access.permissions,
    BAPTISM_CREATE_PERMISSIONS,
  );
  const canUpdateWater = hasPermission(
    access.permissions,
    "baptisms.water.update",
  );
  const canUpdateHolyGhost = hasPermission(
    access.permissions,
    "baptisms.holy_ghost.update",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Spiritual Ministry"
        eyebrowIcon={<Droplets className="h-4 w-4" />}
        title="Baptism Records"
        description="Review baptism history and maintain accurate spiritual ministry records."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/portal/baptisms/new">
                <Plus />
                New Baptism Record
              </Link>
            </Button>
          ) : undefined
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<Droplets className="h-5 w-5" />}
          title="No branch access"
          description="There are no church branches available for your account, so baptism records cannot be displayed."
        />
      ) : (
        <BaptismsTable
          dashboard={dashboard}
          records={records}
          branches={branches}
          canUpdateWater={canUpdateWater}
          canUpdateHolyGhost={canUpdateHolyGhost}
        />
      )}
    </PageContainer>
  );
}

function BaptismsLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </PageContainer>
  );
}
