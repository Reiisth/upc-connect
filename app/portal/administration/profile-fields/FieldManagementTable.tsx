"use client";

import { PROFILE_FIELD_DEFAULTS, isDefaultProfileConfiguration } from "@/lib/profile-field-defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { useEffect, useState } from "react";
import {
  deleteCustomField,
  saveFieldConfiguration,
  restoreDefaultFieldConfiguration
} from "./actions";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
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

  const defaultsMatch = isDefaultProfileConfiguration(items);
  const busy = saving || restoringDefaults || deleting;

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
    if (defaultsMatch || busy) return;
    setRestoringDefaults(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await restoreDefaultFieldConfiguration();
      setItems(current => current.map(field => {
        const defaults = field.is_builtin && PROFILE_FIELD_DEFAULTS.find(item => item.field_key === field.field_key);
        return defaults ? { ...field, ...defaults } : field;
      }));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="ml-auto flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            onClick={() => setShowRestoreDefaults(true)}
            disabled={busy || defaultsMatch}
            variant="outline"
          >
            Restore Defaults
          </Button>

          <Button
            type="button"
            disabled={busy}
            onClick={() => setShowAddField(true)}
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={busy}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Config"}
          </Button>
        </div>
      </div>

      <div>
        <Table className="w-full min-w-[1100px] text-sm">
          <TableHeader className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-4">Order</TableHead>
              <TableHead className="px-4 py-4">Field</TableHead>
              <TableHead className="px-4 py-4">Input Type</TableHead>
              <TableHead className="px-4 py-4">Options</TableHead>
              <TableHead className="px-4 py-4">Placeholder</TableHead>
              <TableHead className="px-4 py-4">Required</TableHead>
              <TableHead className="px-4 py-4">Visible</TableHead>
              <TableHead className="px-4 py-4">Actions</TableHead>
            </TableRow>
          </TableHeader>

          {fieldGroups.map(({ key, label }) => {
            const groupItems = groupedFields[key];

            if (groupItems.length === 0) {
              return null;
            }

            return (
              <TableBody
                key={key}
                className="divide-y"
              >
                <TableRow className="bg-[#EEF3FB]">
                  <TableCell
                    colSpan={8}
                    className="px-4 py-3 font-semibold text-[#203264]"
                  >
                    {label}
                  </TableCell>
                </TableRow>

                {groupItems.map((field, index) => (
                  <TableRow
                    key={field.id}
                    className="align-top transition hover:bg-[#F8FAFD]"
                  >
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          onClick={() =>
                            moveField(field.id, "up")
                          }
                          disabled={index === 0}
                          variant="ghost" size="icon"
                        >
                          <ArrowUp aria-label="Move field up" className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() =>
                            moveField(field.id, "down")
                          }
                          disabled={
                            index === groupItems.length - 1
                          }
                          variant="ghost" size="icon"
                        >
                          <ArrowDown aria-label="Move field down" className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <div className="min-w-[220px] space-y-2">
                        <Input
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
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <Select
                        value={field.field_type}
                        disabled={field.is_builtin}
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
                        <option value="checkbox">Checkbox</option>
                      </Select>
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      {field.field_type === "select" ? (
                        <div className="min-w-[220px] space-y-2">
                          <Select
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
                          </Select>

                          {(field.options_source ?? "custom") === "custom" && (
                            <Textarea
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
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <Input
                        value={field.placeholder ?? ""}
                        onChange={(event) =>
                          updateField(field.id, {
                            placeholder: event.target.value,
                          })
                        }
                        placeholder="Enter placeholder"
                        className="min-w-[220px] rounded-xl border px-3 py-2 outline-none transition focus:border-[#5D94E8]"
                      />
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <Toggle
                        label={field.label + " required"}
                        checked={field.is_required}
                        onChange={(checked) =>
                          updateField(field.id, {
                            is_required: checked,
                          })
                        }
                      />
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <Toggle
                        label={field.label + " visible"}
                        checked={field.is_visible}
                        onChange={(checked) =>
                          updateField(field.id, {
                            is_visible: checked,
                          })
                        }
                      />
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      {!field.is_builtin ? (
                        <Button
                          type="button"
                          onClick={() => setFieldToDelete(field)}
                          variant="ghost" className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Protected
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            );
          })}
        </Table>
      </div>
      {showAddField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <Card role="dialog" aria-modal="true" aria-labelledby="add-field-title" className="w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="add-field-title" className="font-body text-xl font-semibold text-[#203264]">
                  Add Custom Field
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create a new field for member profiles.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setShowAddField(false)}
                variant="ghost" size="icon" aria-label="Close add field"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#203264]">
                  Field Label
                </label>

                <Input
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

                <Select
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
                  <option value="checkbox">Checkbox</option>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setShowAddField(false)}
                variant="outline"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleAddField}

              >
                Add Field
              </Button>
            </div>
          </Card>
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
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <Checkbox aria-label={label} checked={checked} onCheckedChange={value => onChange(value === true)} />;
}
