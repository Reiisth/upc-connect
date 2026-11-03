import { isProfileDefinition } from "@/lib/member-field-policy";
import { Suspense } from "react";
import { SlidersHorizontal } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrationPermission } from "@/app/portal/administration/access";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import FieldManagementTable from "./FieldManagementTable";

export default function FieldManagementPage() {
  return (
    <Suspense fallback={<FieldManagementLoading />}>
      <FieldManagementContent />
    </Suspense>
  );
}

async function FieldManagementContent() {
  await requireAdministrationPermission("administration.view");

  const admin = createAdminClient();

  const { data: fields, error } = await admin
    .from("member_field_definitions")
    .select(`
    id,
    field_key,
    label,
    field_type,
    field_group,
    is_builtin,
    is_required,
    is_visible,
    placeholder,
    options_source,
    options,
    sort_order
  `)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <PageContainer>
      <PageHeader backHref="/portal/administration" backLabel="Back to Administration"
        eyebrow="Administration" eyebrowIcon={<SlidersHorizontal className="h-4 w-4" />}
        title="Profile Fields" description="Configure the fields used in member profiles." />
      <FieldManagementTable fields={(fields ?? []).filter(isProfileDefinition)} />
    </PageContainer>
  );
}

function FieldManagementLoading() {
  return (
    <PageContainer><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-96 max-w-full" /></div><Skeleton className="h-64 rounded-2xl" /></PageContainer>
  );
}
