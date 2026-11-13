"use client";
import { FeedbackMessage } from "@/components/ui/feedback-message";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableActionButton } from "@/components/ui/table-action-button";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { archiveMember, restoreMember } from "./actions";

export function MemberArchiveControl({ memberId, memberName, archived, compact = false }: { memberId: string; memberName?: string; archived: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="space-y-2">
    {compact ? (
      <TableActionButton type="button" variant={archived ? "success" : "danger"} icon={archived ? <RotateCcw /> : <Archive />} onClick={() => { setError(""); setOpen(true); }}>
        {archived ? "Restore Member" : "Archive Member"}
      </TableActionButton>
    ) : (
      <Button variant={archived ? "outline" : "destructive"} onClick={() => { setError(""); setOpen(true); }}>
        {archived ? <RotateCcw /> : <Archive />}{archived ? "Restore Member" : "Archive Member"}
      </Button>
    )}
    <ConfirmActionModal open={open} title={archived ? "Restore member?" : "Archive member?"}
      description={`${memberName ? `${memberName}: ` : ""}${archived ? "Restore this member record. Account state and historical records remain unchanged." : "Archive this member record. Linked accounts and attendance, contribution, baptism, and follow-up history remain unchanged."}`}
      confirmLabel={archived ? "Restore" : "Archive"} loading={pending} onClose={() => { if (!pending) setOpen(false); }}
      onConfirm={() => startTransition(async () => {
        try { await (archived ? restoreMember : archiveMember)(memberId); setOpen(false); router.refresh(); }
        catch { setError("The member archive state could not be changed."); }
      })} />
    {error && <FeedbackMessage>{error}</FeedbackMessage>}
  </div>;
}
