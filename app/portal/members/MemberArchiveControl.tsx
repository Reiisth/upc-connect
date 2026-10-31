"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { archiveMember, restoreMember } from "./actions";

export function MemberArchiveControl({ memberId, archived }: { memberId: string; archived: boolean }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>{archived ? "Restore Member" : "Archive Member"}</Button>
    <ConfirmActionModal open={open} title={archived ? "Restore member?" : "Archive member?"}
      description="Member archive is separate from account archive. Linked accounts and historical attendance/follow-ups remain preserved."
      confirmLabel={archived ? "Restore" : "Archive"} loading={pending} onClose={() => setOpen(false)}
      onConfirm={() => startTransition(async () => {
        try { await (archived ? restoreMember : archiveMember)(memberId); setOpen(false); router.refresh(); }
        catch { setError("The member archive state could not be changed."); }
      })} />
    {error && <p role="alert">{error}</p>}
  </>;
}
