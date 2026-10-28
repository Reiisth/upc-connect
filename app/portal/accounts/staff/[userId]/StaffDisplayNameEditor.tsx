"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { updateStaffDisplayName } from "../actions";

type StaffDisplayNameEditorProps = {
  userId: string;
  initialDisplayName: string | null;
  canEdit: boolean;
  readOnlyReason?: string;
};

export function StaffDisplayNameEditor({
  userId,
  initialDisplayName,
  canEdit,
  readOnlyReason,
}: StaffDisplayNameEditorProps) {
  const router = useRouter();
  const [savedDisplayName, setSavedDisplayName] = useState(
    initialDisplayName ?? "",
  );
  const [draftDisplayName, setDraftDisplayName] = useState(
    initialDisplayName ?? "",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setDraftDisplayName(savedDisplayName);
    setError(null);
    setMessage(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (isPending) return;

    setDraftDisplayName(savedDisplayName);
    setError(null);
    setMessage(null);
    setIsEditing(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDisplayName = draftDisplayName.trim();

    setError(null);
    setMessage(null);

    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    if (trimmedDisplayName.length > 200) {
      setError("Display name must be 200 characters or fewer.");
      return;
    }

    startTransition(async () => {
      try {
        await updateStaffDisplayName(userId, trimmedDisplayName);
        setSavedDisplayName(trimmedDisplayName);
        setDraftDisplayName(trimmedDisplayName);
        setIsEditing(false);
        setMessage("Display name updated.");
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "The display name could not be updated.",
        );
      }
    });
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Display Name
        </p>

        {canEdit && !isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startEditing}
            disabled={isPending}
          >
            <Pencil />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <FormField
            label="Display Name"
            htmlFor="staff-display-name"
            required
            error={error ?? undefined}
            description="This account-level name does not change member profile names."
          >
            <Input
              id="staff-display-name"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
              maxLength={200}
              autoComplete="name"
              disabled={isPending}
              autoFocus
            />
          </FormField>

          <FormActions className="pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEditing}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Display Name"}
            </Button>
          </FormActions>
        </form>
      ) : (
        <p className="mt-1 text-sm text-slate-800">
          {savedDisplayName.trim() || "Unnamed Staff"}
        </p>
      )}

      {!canEdit && (
        <p className="mt-2 text-sm text-slate-500">
          {readOnlyReason ??
            "Display-name editing is unavailable for this account."}
        </p>
      )}

      {message && !isEditing && (
        <p
          role="status"
          className="mt-2 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}
    </div>
  );
}
