import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isProfileDefinition, orderPersonalAnniversary } from "@/lib/member-field-policy";
import { Suspense } from "react";
import { SlidersHorizontal } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrationPermission } from "@/app/portal/administration/access";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import FieldManagementTable from "./FieldManagementTable";

export default function FieldManagementPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="settings" fields={6} metrics={0} columns={8} label="administration profile fields" />}>
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
      <FieldManagementTable fields={orderPersonalAnniversary((fields ?? []).filter(isProfileDefinition))} />
    </PageContainer>
  );
}
