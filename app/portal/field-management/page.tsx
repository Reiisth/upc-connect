import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdministrationPermission } from "@/app/portal/administration/access";
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
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#5D94E8]">
          System Configuration
        </p>

        <h1 className="mt-1 font-body text-3xl font-semibold text-[#203264]">
          Field Management
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure the fields used in member profiles.
        </p>
      </div>

      <FieldManagementTable fields={fields ?? []} />
    </main>
  );
}

function FieldManagementLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
    </div>
  );
}
