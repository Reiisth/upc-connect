"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableActionButton } from "@/components/ui/table-action-button";

import {
  deleteCustomRole,
  setRoleActiveState,
} from "./actions";

type RoleLifecycleActionsProps = {
  roleId: string;
  roleKey: string;
  roleName: string;
  isSystem: boolean;
  isActive: boolean;
  canDeactivate: boolean;
  canDelete: boolean;
  redirectAfterDelete?: boolean;
};

type PendingAction = "deactivate" | "reactivate" | "delete" | null;

const NON_DELETABLE_ROLE_KEYS = new Set([
  "system_admin",
  "member",
  "pastor",
  "accounting_officer",
  "evangelism_officer",
  "spiritual_ministry_officer",
  "usher",
]);

export function RoleLifecycleActions({
  roleId,
  roleKey,
  roleName,
  isSystem,
  isActive,
  canDeactivate,
  canDelete,
  redirectAfterDelete = false,
}: RoleLifecycleActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canChangeActiveState =
    canDeactivate && !["system_admin", "member"].includes(roleKey);
  const canRemoveRole =
    canDelete && !isSystem && !NON_DELETABLE_ROLE_KEYS.has(roleKey);

  if (!canChangeActiveState && !canRemoveRole) {
    return null;
  }

  const isDeleteAction = pendingAction === "delete";
  const isReactivateAction = pendingAction === "reactivate";
  const confirmationDescription = isDeleteAction
    ? "This permanently removes the custom role and its permission mappings. It can only be deleted if no accounts are assigned to it."
    : isReactivateAction
      ? "This role will start granting its assigned permissions again. Existing account assignments will be preserved."
      : "This role will stop granting permissions to assigned accounts. Existing role assignments will be preserved.";
  const modalDescription = error
    ? `${confirmationDescription} Error: ${error}`
    : confirmationDescription;

  function openAction(action: PendingAction) {
    setError(null);
    setPendingAction(action);
  }

  function closeAction() {
    if (!isPending) {
      setPendingAction(null);
      setError(null);
    }
  }

  function confirmAction() {
    if (!pendingAction) return;

    setError(null);

    startTransition(async () => {
      try {
        if (pendingAction === "delete") {
          await deleteCustomRole(roleId);

          if (redirectAfterDelete) {
            router.push("/portal/administration/roles");
          } else {
            router.refresh();
          }
        } else {
          await setRoleActiveState(
            roleId,
            pendingAction === "reactivate",
          );
          router.refresh();
        }

        setPendingAction(null);
      } catch (actionError) {
        setError(getErrorMessage(actionError));
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {canChangeActiveState && (
          <TableActionButton
            type="button"
            variant={isActive ? "danger" : "success"}
            icon={isActive ? <Pause /> : <Play />}
            onClick={() =>
              openAction(isActive ? "deactivate" : "reactivate")
            }
          >
            {isActive ? "Deactivate" : "Reactivate"}
          </TableActionButton>
        )}

        {canRemoveRole && (
          <TableActionButton
            type="button"
            variant="danger"
            icon={<Trash2 />}
            onClick={() => openAction("delete")}
          >
            Delete
          </TableActionButton>
        )}
      </div>

      <ConfirmActionModal
        open={pendingAction !== null}
        title={
          isDeleteAction
            ? `Delete ${roleName}?`
            : isReactivateAction
              ? `Reactivate ${roleName}?`
              : `Deactivate ${roleName}?`
        }
        description={modalDescription}
        confirmLabel={
          isDeleteAction
            ? "Delete Role"
            : isReactivateAction
              ? "Reactivate Role"
              : "Deactivate Role"
        }
        variant={isDeleteAction || !isReactivateAction ? "danger" : "default"}
        loading={isPending}
        onConfirm={confirmAction}
        onClose={closeAction}
      />
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "The role action could not be completed.";
}
