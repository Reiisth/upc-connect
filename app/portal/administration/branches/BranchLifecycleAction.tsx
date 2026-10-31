"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff } from "lucide-react";

import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableActionButton } from "@/components/ui/table-action-button";
import { setBranchActive } from "./actions";

export function BranchLifecycleAction({
  branchId,
  branchName,
  isActive,
}: {
  branchId: string;
  branchName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await setBranchActive(branchId, !isActive);
        setOpen(false);
        router.refresh();
      } catch {
        setError(`The branch could not be ${isActive ? "deactivated" : "activated"}.`);
      }
    });
  }

  return (
    <>
      <TableActionButton
        type="button"
        variant={isActive ? "danger" : "success"}
        icon={isActive ? <PowerOff /> : <Power />}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {isActive ? "Deactivate" : "Activate"}
      </TableActionButton>
      <ConfirmActionModal
        open={open}
        title={`${isActive ? "Deactivate" : "Activate"} ${branchName}?`}
        description={error ?? (isActive
          ? "This branch will no longer be available for new operations. Existing records and branch assignments will be preserved."
          : "This branch will become available for new operations to accounts with branch access.")}
        confirmLabel={isActive ? "Deactivate Branch" : "Activate Branch"}
        variant={isActive ? "danger" : "default"}
        loading={pending}
        onConfirm={confirm}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      />
    </>
  );
}
