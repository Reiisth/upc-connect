import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortalTab } from "@/lib/require-portal-tab";
import FieldToggle from "./FieldToggle";

export default function FieldManagementPage() {
  return (
    <Suspense fallback={<FieldManagementLoading />}>
      <FieldManagementContent />
    </Suspense>
  );
}

async function FieldManagementContent() {
  await requirePortalTab("field_management");

  const admin = createAdminClient();

  const { data: fields, error } = await admin
    .from("member_field_definitions")
    .select(`
      id,
      field_key,
      label,
      field_type,
      is_builtin,
      is_required,
      is_visible,
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

        <h1 className="mt-1 font-heading text-3xl font-semibold text-[#203264]">
          Field Management
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure the fields used in member profiles.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Field</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Required</th>
              <th className="px-5 py-4">Visible</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {fields?.map((field) => (
              <tr
                key={field.id}
                className="transition hover:bg-[#F8FAFD]"
              >
                <td className="px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#203264]">
                        {field.label}
                      </p>

                      {field.is_builtin && (
                        <span className="rounded-full bg-[#EEF3FB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#203264]">
                          Built-in
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {field.field_key}
                    </p>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className="rounded-full bg-[#EEF3FB] px-2.5 py-1 text-xs font-medium text-[#203264]">
                    {field.field_type}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FieldToggle
                      fieldId={field.id}
                      setting="is_required"
                      checked={field.is_required}
                      checkedLabel="Required"
                      uncheckedLabel="Optional"
                    />
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FieldToggle
                      fieldId={field.id}
                      setting="is_visible"
                      checked={field.is_visible}
                      checkedLabel="Visible"
                      uncheckedLabel="Hidden"
                    />

                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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