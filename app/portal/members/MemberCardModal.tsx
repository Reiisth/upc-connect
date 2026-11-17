"use client";

import { X } from "lucide-react";
import { useId } from "react";
import { Dialog } from "@/components/ui/dialog";
import MemberCard from "../components/MemberCard";

type MemberCardModalProps = {
  onClose: () => void;
  member: Parameters<typeof MemberCard>[0]["member"];
};

export default function MemberCardModal({
  onClose,
  member,
}: MemberCardModalProps) {
  const id = useId();
  return <Dialog open onClose={onClose} labelledBy={id} className="max-w-[460px] border-0 p-0">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <h2 id={id} className="font-radio-canada text-lg font-semibold text-[#203264]">Member card</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#365FA6]"
          data-dialog-initial-focus
          aria-label="Close member card"
        >
          <X className="h-5 w-5" />
        </button>

      </div>
      <MemberCard member={member} />
    </Dialog>;
}
