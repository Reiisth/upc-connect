"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Power, PowerOff } from "lucide-react";

import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableActionButton } from "@/components/ui/table-action-button";
import { setDepartmentActive } from "./actions";

export function DepartmentLifecycleAction({
  departmentId,
  name,
  isActive,
}: {
  departmentId: string;
  name: string;
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
        await setDepartmentActive(departmentId, !isActive);
        setOpen(false);
        router.refresh();
      } catch {
        setError(`The department could not be ${isActive ? "deactivated" : "activated"}.`);
      }
    });
  }

  return (
    <>
      <TableActionButton
        type="button"
        variant={isActive ? "danger" : "success"}
        icon={isActive ? <PowerOff /> : <Power />}
        onClick={() => { setError(null); setOpen(true); }}
      >
        {isActive ? "Deactivate" : "Activate"}
      </TableActionButton>
      <ConfirmActionModal
        open={open}
        title={`${isActive ? "Deactivate" : "Activate"} ${name}?`}
        description={error ?? (isActive
          ? "This department will no longer be available for new assignments. Existing Member records will keep this department."
          : "This department will be available for new Member assignments again.")}
        confirmLabel={isActive ? "Deactivate Department" : "Activate Department"}
        variant={isActive ? "danger" : "default"}
        loading={pending}
        onConfirm={confirm}
        onClose={() => { if (!pending) setOpen(false); }}
      />
    </>
  );
}
