import Link from "next/link";
import { Suspense } from "react";
import {
  Droplets,
  HeartHandshake,
  Plus,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  canManageBaptisms,
  requireBaptismsAccess,
} from "./access";
import BaptismsTable from "./BaptismsTable";
import {
  loadBaptismOptions,
  loadBaptismRecords,
} from "./data";
import { getBaptismSummary } from "./types";

export default function BaptismsPage() {
  return (
    <Suspense fallback={<BaptismsLoading />}>
      <BaptismsContent />
    </Suspense>
  );
}

async function BaptismsContent() {
  const access = await requireBaptismsAccess();
  const admin = createAdminClient();
  const options = await loadBaptismOptions(access, admin);
  const records = await loadBaptismRecords(
    admin,
    options.branches,
  );
  const summary = getBaptismSummary(records);
  const canManage = canManageBaptisms(access);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Spiritual Ministry"
        eyebrowIcon={<Droplets className="h-4 w-4" />}
        title="Baptism Records"
        description="Review baptism history and maintain accurate spiritual ministry records."
        action={
          canManage ? (
            <Button asChild>
              <Link href="/portal/baptisms/new">
                <Plus />
                New Baptism Record
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <BaptismSummaryCard
          label="Total Baptism Records"
          value={summary.count}
          icon={<Droplets />}
        />

        <BaptismSummaryCard
          label="Water Baptisms"
          value={summary.waterCount}
          icon={<Waves />}
          valueClassName="text-blue-700 dark:text-blue-400"
        />

        <BaptismSummaryCard
          label="Holy Ghost Baptisms"
          value={summary.holyGhostCount}
          icon={<HeartHandshake />}
          valueClassName="text-emerald-700 dark:text-emerald-400"
        />
      </div>

      {options.branches.length === 0 ? (
        <EmptyState
          icon={<Droplets className="h-5 w-5" />}
          title="No active branch access"
          description="There are no active church branches available for your account, so baptism records cannot be displayed."
        />
      ) : (
        <BaptismsTable
          records={records}
          branches={options.branches}
          canManage={canManage}
        />
      )}
    </PageContainer>
  );
}

function BaptismSummaryCard({
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
          <div className="min-w-0">
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
