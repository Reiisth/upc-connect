import Link from "next/link";
import { Suspense } from "react";
import { HeartHandshake, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  requireWeddingsPermission,
} from "./access";
import { loadWeddingOptions, loadWeddingRecords } from "./data";
import WeddingsTable from "./WeddingsTable";

export default function WeddingsPage() {
  return (
    <Suspense fallback={<WeddingsLoading />}>
      <WeddingsContent />
    </Suspense>
  );
}

async function WeddingsContent() {
  const access = await requireWeddingsPermission("weddings.view");
  const admin = createAdminClient();
  const options = await loadWeddingOptions(access, admin);
  const records = await loadWeddingRecords(
    admin,
    options.branches,
  );
  const canCreate = hasPermission(
    access.permissions,
    "weddings.create",
  );
  const canUpdate = hasPermission(
    access.permissions,
    "weddings.update",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Family Records"
        eyebrowIcon={<HeartHandshake className="h-4 w-4" />}
        title="Wedding Records"
        description="Review wedding history and maintain accurate branch records."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/portal/weddings/new">
                <Plus />
                New Wedding Record
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <WeddingSummaryCard
          label="Visible Wedding Records"
          value={records.length}
          icon={<HeartHandshake />}
        />

        <WeddingSummaryCard
          label="Accessible Active Branches"
          value={options.branches.length}
          icon={<HeartHandshake />}
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />
      </div>

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so wedding records cannot be displayed."
        />
      ) : (
        <WeddingsTable
          records={records}
          branches={options.branches}
          canUpdate={canUpdate}
        />
      )}
    </PageContainer>
  );
}

function WeddingSummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264] dark:text-slate-100",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>

            <p className={`mt-3 text-3xl font-semibold ${valueClassName}`}>
              {value.toLocaleString("en-PH")}
            </p>
          </div>

          <div className="rounded-xl bg-[#EEF3FB] p-2.5 text-[#203264] dark:bg-slate-800 dark:text-slate-200 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeddingsLoading() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
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
