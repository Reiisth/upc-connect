import { cacheLife, cacheTag } from "next/cache";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { loadModuleSummary } from "@/lib/module-summary";
import Link from "next/link";
import { Suspense } from "react";
import {
  HandCoins,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

import { createAdminClient } from "@/lib/supabase/admin";
import { getHistoricalRecordBranches } from "@/lib/historical-records";

import {
  requireContributionsPermission,
} from "./access";
import { hasPermission } from "@/lib/permissions";
import { loadContributionRecords } from "./data";
import ContributionsTable from "./ContributionsTable";

export default function ContributionsPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="dashboard" fields={6} metrics={4} columns={5} label="contributions" />}>
      <ContributionsContent />
    </Suspense>
  );
}

async function ContributionsContent() {
  "use cache: private";
  cacheLife({ stale: 30 });
  cacheTag("portal:contributions");
  const access = await requireContributionsPermission(
    "contributions.view",
  );
  const admin = createAdminClient();
  const branches = await getHistoricalRecordBranches(access, admin);
  const [records, dashboard] = await Promise.all([
    loadContributionRecords(admin, branches),
    loadModuleSummary(admin, "contributions", branches.map(branch => branch.id)),
  ]);
  const canCreate = hasPermission(
    access.permissions,
    "contributions.create",
  );
  const canUpdate = hasPermission(
    access.permissions,
    "contributions.update",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Financial Operations"
        eyebrowIcon={<HandCoins className="h-4 w-4" />}
        title="Contributions"
        description="Review branch contributions and maintain accurate financial records."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/portal/contributions/new">
                <Plus />
                New Contribution
              </Link>
            </Button>
          ) : undefined
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-5 w-5" />}
          title="No branch access"
          description="There are no church branches available for your account, so contributions cannot be displayed."
        />
      ) : (
        <ContributionsTable
          dashboard={dashboard}
          records={records}
          branches={branches}
          canUpdate={canUpdate}
        />
      )}
    </PageContainer>
  );
}
