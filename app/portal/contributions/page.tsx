import Link from "next/link";
import { Suspense } from "react";
import {
  DollarSign,
  HandCoins,
  HeartHandshake,
  Plus,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  canManageContributions,
  requireContributionsAccess,
} from "./access";
import { loadContributionOptions, loadContributionRecords } from "./data";
import ContributionsTable from "./ContributionsTable";
import {
  formatContributionCents,
  getContributionSummary,
} from "./types";

export default function ContributionsPage() {
  return (
    <Suspense fallback={<ContributionsLoading />}>
      <ContributionsContent />
    </Suspense>
  );
}

async function ContributionsContent() {
  const access = await requireContributionsAccess();
  const admin = createAdminClient();
  const options = await loadContributionOptions(access, admin);
  const records = await loadContributionRecords(
    admin,
    options.branches,
  );
  const summary = getContributionSummary(records);
  const canManage = canManageContributions(access);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Financial Operations"
        eyebrowIcon={<HandCoins className="h-4 w-4" />}
        title="Contributions"
        description="Review branch contributions and maintain accurate financial records."
        action={
          canManage ? (
            <Button asChild>
              <Link href="/portal/contributions/new">
                <Plus />
                New Contribution
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContributionSummaryCard
          label="Total Contributions"
          value={summary.count.toLocaleString("en-PH")}
          icon={<Receipt />}
        />

        <ContributionSummaryCard
          label="Total Amount"
          value={formatContributionCents(summary.totalAmountCents)}
          icon={<DollarSign />}
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />

        <ContributionSummaryCard
          label="Tithe Total"
          value={formatContributionCents(summary.titheTotalCents)}
          icon={<HandCoins />}
          valueClassName="text-[#203264] dark:text-slate-100"
        />

        <ContributionSummaryCard
          label="Love Offering Total"
          value={formatContributionCents(summary.loveOfferingTotalCents)}
          icon={<HeartHandshake />}
          valueClassName="text-blue-700 dark:text-blue-400"
        />
      </div>

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so contributions cannot be displayed."
        />
      ) : (
        <ContributionsTable
          records={records}
          branches={options.branches}
          canManage={canManage}
        />
      )}
    </PageContainer>
  );
}

function ContributionSummaryCard({
  label,
  value,
  icon,
  valueClassName = "text-[#203264] dark:text-slate-100",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>

            <p className={`mt-3 truncate text-2xl font-semibold ${valueClassName}`}>
              {value}
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
