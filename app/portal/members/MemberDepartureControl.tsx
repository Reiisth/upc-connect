"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { recordMemberDeparture } from "./actions";

export function MemberDepartureControl({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="space-y-2">
    <Button type="button" variant="outline" onClick={() => { setError(""); setOpen(true); }}><LogOut />Record Departure</Button>
    <ConfirmActionModal open={open} title="Record departure from the church?" destructive confirmLabel="Record departure" loading={pending}
      description="This records a departure dated now and archives the member, removing them from current operational lists. Their branch, linked account and historical records are preserved. An ordinary archive does not count as a departure."
      onClose={() => { if (!pending) setOpen(false); }} onConfirm={() => startTransition(async () => {
        try { await recordMemberDeparture(memberId); setOpen(false); router.refresh(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Departure could not be recorded."); }
      })} />
    {error && <FeedbackMessage>{error}</FeedbackMessage>}
  </div>;
}
