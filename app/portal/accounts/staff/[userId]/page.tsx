import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  Building2,
  ExternalLink,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { requirePortalTab } from "@/lib/require-portal-tab";
import { createAdminClient } from "@/lib/supabase/admin";

import type { StaffAccountStatus } from "../StaffAccountsTable";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  archived_at: string | null;
};

type BranchRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type BranchAccessRow = {
  church_branch_id: string;
};

export default function StaffAccountDetailsPage(
  props: PageProps,
) {
  return (
    <Suspense fallback={<StaffAccountDetailsSkeleton />}>
      <StaffAccountDetailsContent {...props} />
    </Suspense>
  );
}

async function StaffAccountDetailsContent({
  params,
}: PageProps) {
  await requirePortalTab("accounts");

  const { userId } = await params;
  const admin = createAdminClient();

  const [
    { data: authData, error: authError },
    { data: roleLinks, error: roleError },
    { data: profile, error: profileError },
    { data: branchRows, error: branchError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),

    admin
      .from("user_roles")
      .select(`
        roles!inner (
          name
        )
      `)
      .eq("user_id", userId)
      .neq("roles.name", "member"),

    admin
      .from("profiles")
      .select("id, display_name, archived_at")
      .eq("id", userId)
      .maybeSingle(),

    admin
      .from("church_branches")
      .select("id, name, code, is_active")
      .order("name"),

    admin
      .from("user_branch_access")
      .select("church_branch_id")
      .eq("user_id", userId),
  ]);

  if (authError || !authData.user) {
    notFound();
  }

  if (roleError) throw new Error(roleError.message);
  if (profileError) throw new Error(profileError.message);
  if (branchError) throw new Error(branchError.message);
  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const roleNames = Array.from(
    new Set(
      (roleLinks ?? []).flatMap((link) => {
        const roles = link.roles as
          | { name: string }
          | { name: string }[]
          | null;

        if (!roles) return [];

        const roleList = Array.isArray(roles)
          ? roles
          : [roles];

        return roleList
          .map((role) => role.name)
          .filter((role) => role !== "member");
      }),
    ),
  );

  if (roleNames.length === 0) {
    notFound();
  }

  const user = authData.user;
  const profileData = profile as ProfileRow | null;
  const branches = (branchRows ?? []) as BranchRow[];
  const assignedBranchIds = new Set(
    ((assignments ?? []) as BranchAccessRow[]).map(
      (assignment) => assignment.church_branch_id,
    ),
  );
  const assignedBranches = branches.filter((branch) =>
    assignedBranchIds.has(branch.id),
  );
  const isSystemAdmin = roleNames.includes("system_admin");
  const status = getAccountStatus({
    archivedAt: profileData?.archived_at ?? null,
    deletedAt: user.deleted_at ?? null,
    bannedUntil: user.banned_until ?? null,
    invitedAt: user.invited_at ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
  });
  const emailState = getEmailState({
    email: user.email ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    invitedAt: user.invited_at ?? null,
  });
  const email = user.email ?? "No email";
  const title = profileData?.display_name?.trim() || email;

  return (
    <PageContainer>
      <PageHeader
        backHref="/portal/accounts/staff"
        backLabel="Back to Staff Accounts"
        eyebrow="Staff Account"
        eyebrowIcon={<UserRoundCog className="h-4 w-4" />}
        title={title}
        description="View staff account access and account information."
      />

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-[#5D94E8]" />

            <div>
              <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
                Account Information
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Read-only authentication and account details.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Display Name">
              {profileData?.display_name || "Unnamed Staff"}
            </InfoItem>

            <InfoItem label="Email">{email}</InfoItem>

            <InfoItem label="Account ID">
              <span className="break-all font-mono text-xs">
                {user.id}
              </span>
            </InfoItem>

            <InfoItem label="Account Status">
              <StatusBadge variant={statusVariants[status]}>
                {statusLabels[status]}
              </StatusBadge>
            </InfoItem>

            <InfoItem label="Created">
              {formatDate(user.created_at)}
            </InfoItem>

            <InfoItem label="Last Sign-in">
              {formatDate(user.last_sign_in_at ?? null)}
            </InfoItem>

            <InfoItem label="Email State">
              <StatusBadge variant={emailState.variant}>
                {emailState.label}
              </StatusBadge>
            </InfoItem>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#5D94E8]" />

            <div>
              <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
                Roles
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Assigned non-member roles for this account.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {roleNames.map((role) => (
              <StatusBadge key={role} variant="info">
                {formatRole(role)}
              </StatusBadge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#5D94E8]" />

            <div>
              <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
                Branch Access
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isSystemAdmin
                  ? "System administrator access is automatic."
                  : "Church branches currently assigned to this account."}
              </p>
            </div>
          </div>

          {isSystemAdmin ? (
            <div className="flex items-start gap-3 rounded-2xl bg-[#EEF3FB] p-4 dark:bg-slate-800">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#203264] dark:text-slate-200" />

              <div>
                <StatusBadge variant="info">
                  All active branches
                </StatusBadge>

                <p className="mt-2 text-sm text-[#203264] dark:text-slate-200">
                  System administrators automatically have access to every active church branch.
                </p>
              </div>
            </div>
          ) : assignedBranches.length > 0 ? (
            <div className="space-y-3">
              {assignedBranches.map((branch) => (
                <div
                  key={branch.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {branch.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {branch.code
                          ? `Code: ${branch.code}`
                          : "No branch code"}
                      </p>
                    </div>

                    <StatusBadge
                      variant={branch.is_active ? "success" : "muted"}
                    >
                      {branch.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No branch access assigned"
              description="This staff account does not have an explicit church branch assignment."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="font-prompt text-lg font-semibold text-[#203264] dark:text-slate-100">
            Account Actions
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Available account-management navigation is read-only here.
          </p>

          {profileData && (
            <div className="mt-5">
              <Button asChild variant="outline">
                <Link
                  href={`/portal/administration/staff-branch-access/${userId}`}
                >
                  <ExternalLink />
                  Manage Branch Access
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

function getAccountStatus({
  archivedAt,
  deletedAt,
  bannedUntil,
  invitedAt,
  emailConfirmedAt,
}: {
  archivedAt: string | null;
  deletedAt: string | null;
  bannedUntil: string | null;
  invitedAt: string | null;
  emailConfirmedAt: string | null;
}): StaffAccountStatus {
  // Keep the list and detail views consistent: Deleted > Archived > Banned > Invited > Unconfirmed > Active.
  if (deletedAt) return "deleted";
  if (archivedAt) return "archived";

  if (bannedUntil) {
    const bannedUntilTime = Date.parse(bannedUntil);

    if (
      Number.isFinite(bannedUntilTime) &&
      bannedUntilTime > Date.now()
    ) {
      return "banned";
    }
  }

  if (!emailConfirmedAt && invitedAt) return "invited";
  if (!emailConfirmedAt) return "unconfirmed";

  return "active";
}

function getEmailState({
  email,
  emailConfirmedAt,
  invitedAt,
}: {
  email: string | null;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
}) {
  if (!email) {
    return {
      label: "No email available",
      variant: "muted" as const,
    };
  }

  if (emailConfirmedAt) {
    return {
      label: "Confirmed",
      variant: "success" as const,
    };
  }

  if (invitedAt) {
    return {
      label: "Invitation pending",
      variant: "warning" as const,
    };
  }

  return {
    label: "Unconfirmed",
    variant: "muted" as const,
  };
}

const statusLabels: Record<StaffAccountStatus, string> = {
  active: "Active",
  invited: "Invited",
  unconfirmed: "Unconfirmed",
  banned: "Banned",
  archived: "Archived",
  deleted: "Deleted",
};

const statusVariants: Record<
  StaffAccountStatus,
  "success" | "warning" | "danger" | "muted"
> = {
  active: "success",
  invited: "warning",
  unconfirmed: "warning",
  banned: "danger",
  archived: "muted",
  deleted: "danger",
};

function formatRole(role: string) {
  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StaffAccountDetailsSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
    </PageContainer>
  );
}
