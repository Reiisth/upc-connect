"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UserRound } from "lucide-react";

export default function MobileProfileInfo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={container} className="relative">
    <button ref={trigger} type="button" aria-label="Profile information" title="Profile information"
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#203264] transition hover:bg-[#EEF3FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8]">
      <UserRound className="h-5 w-5" aria-hidden="true" />
    </button>
    {open && <div id={id} className="absolute right-0 top-full z-[60] mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border bg-white p-2 shadow-xl">
      {children}
    </div>}
  </div>;
}
