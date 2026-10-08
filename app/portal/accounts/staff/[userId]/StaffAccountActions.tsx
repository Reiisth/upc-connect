"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { Button } from "@/components/ui/button";

import {
  archiveStaffAccount,
  restoreStaffAccount,
} from "../actions";

type StaffAccountActionsProps = {
  userId: string;
  accountLabel: string;
  isArchived: boolean;
};

export function StaffAccountActions({
  userId,
  accountLabel,
  isArchived,
}: StaffAccountActionsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const actionName = isArchived ? "restore" : "archive";
  const actionDescription = isArchived
    ? `Restore ${accountLabel}? The account's existing roles and branch assignments will be preserved.`
    : `Archive ${accountLabel}? The Auth account, roles, branch assignments, and historical records will be preserved.`;

  async function handleAction() {
    setActionError(null);
    setActionLoading(true);

    try {
      if (actionName === "restore") {
        await restoreStaffAccount(userId);
      } else {
        await archiveStaffAccount(userId);
      }

      router.refresh();
      setModalOpen(false);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  }

  function openModal() {
    setActionError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (actionLoading) return;

    setModalOpen(false);
    setActionError(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={isArchived ? "outline" : "destructive"}
          onClick={openModal}
        >
          {isArchived ? <RotateCcw /> : <Archive />}
          {isArchived ? "Restore Account" : "Archive Account"}
        </Button>

        {actionError && (
          <p
            role="alert"
            className="basis-full rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {actionError}
          </p>
        )}
      </div>

      <ConfirmActionModal
        open={modalOpen}
        title={
          isArchived
            ? "Restore staff account?"
            : "Archive staff account?"
        }
        description={
          actionError
            ? `${actionDescription} Error: ${actionError}`
            : actionDescription
        }
        confirmLabel={
          isArchived ? "Restore Account" : "Archive Account"
        }
        variant={isArchived ? "default" : "danger"}
        loading={actionLoading}
        onConfirm={handleAction}
        onClose={closeModal}
      />
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The account action could not be completed.";
}
