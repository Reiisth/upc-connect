"use client";

import { useEffect, useState } from "react";
import {
  deleteCustomField,
  saveFieldConfiguration,
  restoreDefaultFieldConfiguration
} from "./actions";
import ConfirmActionModal from "../members/ConfirmActionModal";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Save,
  Plus,
  X,
  Trash2
} from "lucide-react";

type FieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  field_group: string;
  is_builtin: boolean;
  is_required: boolean;
  is_visible: boolean;
  placeholder: string | null;
  options_source: string | null;
  options: unknown;
  sort_order: number;
};

type Props = {
  fields: FieldDefinition[];
};

export default function FieldManagementTable({
  fields,
}: Props) {
  const [items, setItems] = useState<FieldDefinition[]>(fields);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [fieldToDelete, setFieldToDelete] =
    useState<FieldDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRestoreDefaults, setShowRestoreDefaults] =
    useState(false);
  const [restoringDefaults, setRestoringDefaults] =
    useState(false);
  const router = useRouter();

  const groupedFields = {
    personal: items
      .filter((field) => field.field_group === "personal")
      .sort((a, b) => a.sort_order - b.sort_order),

    address: items
      .filter((field) => field.field_group === "address")
      .sort((a, b) => a.sort_order - b.sort_order),

    church: items
      .filter((field) => field.field_group === "church")
      .sort((a, b) => a.sort_order - b.sort_order),

    additional: items
      .filter((field) => field.field_group === "additional")
      .sort((a, b) => a.sort_order - b.sort_order),
  };

  const fieldGroups = [
    {
      key: "personal",
      label: "Personal Information",
    },
    {
      key: "address",
      label: "Address",
    },
    {
      key: "church",
      label: "Church Information",
    },
    {
      key: "additional",
      label: "Additional Information",
    },
  ] as const;

  useEffect(() => {
    setItems(fields);
  }, [fields]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [successMessage]);

  function updateField(
    id: string,
    patch: Partial<FieldDefinition>,
  ) {
    setItems((current) =>
      current.map((field) =>
        field.id === id
          ? { ...field, ...patch }
          : field,
      ),
    );
  }
  function handleAddField() {
    const label = newFieldLabel.trim();

    if (!label) {
      setErrorMessage("Field label is required.");
      return;
    }

    const fieldKey = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!fieldKey) {
      setErrorMessage("Please enter a valid field label.");
      return;
    }

    const duplicate = items.some(
      (field) => field.field_key === fieldKey,
    );

    if (duplicate) {
      setErrorMessage(
        "A field with the same field key already exists.",
      );
      return;
    }

    const maxSortOrder =
      items.length > 0
        ? Math.max(...items.map((field) => field.sort_order))
        : 0;

    const newField: FieldDefinition = {
      id: `new-${crypto.randomUUID()}`,
      field_key: fieldKey,
      label,
      field_type: newFieldType,
      field_group: "additional",
      is_builtin: false,
      is_required: false,
      is_visible: true,
      placeholder: null,
      options_source:
        newFieldType === "select" ? "custom" : null,
      options: newFieldType === "select" ? [] : null,
      sort_order: maxSortOrder + 1,
    };

    setItems((current) => [...current, newField]);

    setNewFieldLabel("");
    setNewFieldType("text");
    setErrorMessage(null);
    setShowAddField(false);
  }

  async function handleDeleteField() {
    if (!fieldToDelete) return;

    setDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Field has not been saved to Supabase yet.
      if (fieldToDelete.id.startsWith("new-")) {
        setItems((current) =>
          current.filter(
            (field) => field.id !== fieldToDelete.id,
          ),
        );
      } else {
        await deleteCustomField(fieldToDelete.id);

        setItems((current) =>
          current.filter(
            (field) => field.id !== fieldToDelete.id,
          ),
        );
      }

      setFieldToDelete(null);
      setSuccessMessage("Custom field deleted successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete custom field.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function moveField(
    id: string,
    direction: "up" | "down",
  ) {
    setItems((current) => {
      const fieldToMove = current.find(
        (field) => field.id === id,
      );

      if (!fieldToMove) {
        return current;
      }

      const groupFields = current
        .filter(
          (field) =>
            field.field_group === fieldToMove.field_group,
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order,
        );

      const index = groupFields.findIndex(
        (field) => field.id === id,
      );

      if (index === -1) {
        return current;
      }

      const targetIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= groupFields.length
      ) {
        return current;
      }

      [
        groupFields[index],
        groupFields[targetIndex],
      ] = [
          groupFields[targetIndex],
          groupFields[index],
        ];

      const reorderedGroup = groupFields.map(
        (field, index) => ({
          ...field,
          sort_order: index + 1,
        }),
      );

      return current.map((field) => {
        const updatedField =
          reorderedGroup.find(
            (item) => item.id === field.id,
          );

        return updatedField ?? field;
      });
    });
  }

  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await saveFieldConfiguration(
        items.map((field) => ({
          id: field.id,
          field_key: field.field_key,
          label: field.label,
          field_type: field.field_type,
          field_group: field.field_group,
          is_required: field.is_required,
          is_visible: field.is_visible,
          placeholder: field.placeholder,
          options_source: field.options_source,
          options: field.options,
          sort_order: field.sort_order,
        })),
      );

      router.refresh();

      setSuccessMessage("Field configuration saved successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save field configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreDefaults() {
    setRestoringDefaults(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await restoreDefaultFieldConfiguration();

      setShowRestoreDefaults(false);

      router.refresh();

      setSuccessMessage(
        "Built-in fields restored to default configuration.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to restore default fields.",
      );
    } finally {
      setRestoringDefaults(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowRestoreDefaults(true)}
            disabled={restoringDefaults}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Restore Defaults
          </button>

          <button
            type="button"
            onClick={() => setShowAddField(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#203264] px-4 py-2.5 text-sm font-medium text-[#203264] transition hover:bg-[#EEF3FB]"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#203264] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#18264D] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Config"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-4">Order</th>
              <th className="px-4 py-4">Field</th>
              <th className="px-4 py-4">Input Type</th>
              <th className="px-4 py-4">Options</th>
              <th className="px-4 py-4">Placeholder</th>
              <th className="px-4 py-4">Required</th>
              <th className="px-4 py-4">Visible</th>
              <th className="px-4 py-4">Actions</th>
            </tr>
          </thead>

          {fieldGroups.map(({ key, label }) => {
            const groupItems = groupedFields[key];

            if (groupItems.length === 0) {
              return null;
            }

            return (
              <tbody
                key={key}
                className="divide-y"
              >
                <tr className="bg-[#EEF3FB]">
                  <td
                    colSpan={8}
                    className="px-4 py-3 font-semibold text-[#203264]"
                  >
                    {label}
                  </td>
                </tr>

                {groupItems.map((field, index) => (
                  <tr
                    key={field.id}
                    className="align-top transition hover:bg-[#F8FAFD]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            moveField(field.id, "up")
                          }
                          disabled={index === 0}
                          className="rounded-lg border p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moveField(field.id, "down")
                          }
                          disabled={
                            index === groupItems.length - 1
                          }
                          className="rounded-lg border p-1.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="min-w-[220px] space-y-2">
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateField(field.id, {
                              label: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border px-3 py-2 outline-none transition focus:border-[#5D94E8]"
                        />

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {field.field_key}
                          </span>

                          {field.is_builtin && (
                            <span className="rounded-full bg-[#EEF3FB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#203264]">
                              Built-in
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <select
                        value={field.field_type}
                        onChange={(event) =>
                          updateField(field.id, {
                            field_type: event.target.value,
                          })
                        }
                        className="min-w-[150px] rounded-xl border bg-white px-3 py-2 outline-none transition focus:border-[#5D94E8]"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Dropdown</option>
                        <option value="textarea">Textarea</option>
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      {field.field_type === "select" ? (
                        <div className="min-w-[220px] space-y-2">
                          <select
                            value={field.options_source ?? "custom"}
                            onChange={(event) =>
                              updateField(field.id, {
                                options_source: event.target.value,
                              })
                            }
                            className="w-full rounded-xl border bg-white px-3 py-2 outline-none transition focus:border-[#5D94E8]"
                          >
                            <option value="custom">Custom Options</option>
                            <option value="departments">Departments</option>
                            <option value="church_branches">Church Branches</option>
                            <option value="psgc_regions">Regions</option>
                          </select>

                          {(field.options_source ?? "custom") === "custom" && (
                            <textarea
                              value={
                                Array.isArray(field.options)
                                  ? field.options.join("\n")
                                  : ""
                              }
                              onChange={(event) =>
                                updateField(field.id, {
                                  options: event.target.value
                                    .split("\n")
                                    .map((option) => option.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder={"One option per line"}
                              rows={4}
                              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-[#5D94E8]"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not applicable
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <input
                        value={field.placeholder ?? ""}
                        onChange={(event) =>
                          updateField(field.id, {
                            placeholder: event.target.value,
                          })
                        }
                        placeholder="Enter placeholder"
                        className="min-w-[220px] rounded-xl border px-3 py-2 outline-none transition focus:border-[#5D94E8]"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <Toggle
                        checked={field.is_required}
                        onChange={(checked) =>
                          updateField(field.id, {
                            is_required: checked,
                          })
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <Toggle
                        checked={field.is_visible}
                        onChange={(checked) =>
                          updateField(field.id, {
                            is_visible: checked,
                          })
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      {!field.is_builtin ? (
                        <button
                          type="button"
                          onClick={() => setFieldToDelete(field)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      {showAddField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-body text-xl font-semibold text-[#203264]">
                  Add Custom Field
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create a new field for member profiles.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddField(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#203264]">
                  Field Label
                </label>

                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(event) => setNewFieldLabel(event.target.value)}
                  placeholder="e.g. Occupation"
                  className="w-full rounded-xl border px-3 py-2.5 outline-none transition focus:border-[#5D94E8]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#203264]">
                  Input Type
                </label>

                <select
                  value={newFieldType}
                  onChange={(event) => setNewFieldType(event.target.value)}
                  className="w-full rounded-xl border bg-white px-3 py-2.5 outline-none transition focus:border-[#5D94E8]"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                  <option value="textarea">Textarea</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddField(false)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddField}
                className="rounded-xl bg-[#203264] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#18264D]"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={showRestoreDefaults}
        title="Restore default fields?"
        description="All built-in fields will be restored to their default labels, input types, groups, placeholders, options, visibility, required settings, and order. Custom fields will not be changed."
        confirmLabel="Restore Defaults"
        loadingLabel="Restoring..."
        loading={restoringDefaults}
        onConfirm={handleRestoreDefaults}
        onClose={() => {
          if (!restoringDefaults) {
            setShowRestoreDefaults(false);
          }
        }}
      />

      <ConfirmActionModal
        open={Boolean(fieldToDelete)}
        title="Delete custom field?"
        description={
          fieldToDelete
            ? `"${fieldToDelete.label}" will be permanently removed from member profiles.`
            : ""
        }
        confirmLabel="Delete Field"
        loadingLabel="Deleting..."
        loading={deleting}
        destructive
        onConfirm={handleDeleteField}
        onClose={() => {
          if (!deleting) {
            setFieldToDelete(null);
          }
        }}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked
        ? "bg-[#5D94E8]"
        : "bg-slate-300"
        }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"
          }`}
      />
    </button>
  );
}