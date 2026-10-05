"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import MemberCard from "../components/MemberCard";

type MemberCardModalProps = {
  onClose: () => void;
  member: Parameters<typeof MemberCard>[0]["member"];
};

export default function MemberCardModal({
  onClose,
  member,
}: MemberCardModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[460px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute left-0 top-0 z-20 rounded-xl bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close member card"
        >
          <X className="h-5 w-5" />
        </button>

        <MemberCard member={member} />
      </div>
    </div>,
    document.body,
  );
}