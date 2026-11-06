import { loadModuleSummary } from "@/lib/module-summary";
import Link from "next/link";
import { Suspense } from "react";
import {
  HandCoins,
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
  requireContributionsPermission,
} from "./access";
import { hasPermission } from "@/lib/permissions";
import { loadContributionRecords } from "./data";
import ContributionsTable from "./ContributionsTable";

export default function ContributionsPage() {
  return (
    <Suspense fallback={<ContributionsLoading />}>
      <ContributionsContent />
    </Suspense>
  );
}

async function ContributionsContent() {
  const access = await requireContributionsPermission(
    "contributions.view",
  );
  const admin = createAdminClient();
  const branches = await getHistoricalRecordBranches(access, admin);
  const records = await loadContributionRecords(
    admin,
    branches,
  );
  const dashboard = await loadModuleSummary(admin, "contributions", branches.map(b => b.id));
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

function ContributionsLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-28" />
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
