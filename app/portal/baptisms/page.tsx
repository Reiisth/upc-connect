import { PageSkeleton } from "@/components/ui/page-skeleton";
import { loadModuleSummary } from "@/lib/module-summary";
import Link from "next/link";
import { Suspense } from "react";
import {
  Droplets,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

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
    <Suspense fallback={<PageSkeleton kind="dashboard" fields={6} metrics={4} columns={5} label="baptisms" />}>
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
