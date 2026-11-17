"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function MobileNavigation({ primary, moreRoutes, children }: {
  primary: ReactNode; moreRoutes: string[]; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const active = moreRoutes.some(href => pathname === href || pathname.startsWith(`${href.startsWith("/portal/accounts/") ? "/portal/accounts" : href}/`));
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  return <>
    <nav aria-label="Primary navigation" className="portal-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-4px_24px_rgba(32,50,100,0.06)] backdrop-blur-md md:hidden">
      <div className="flex items-stretch gap-1 px-2 pt-2">
        {primary}
        {moreRoutes.length > 0 && <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
          aria-label={active ? "More navigation, current section" : "More navigation"} onClick={() => setOpen(true)}
          className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] ${active ? "bg-[#EEF3FB] text-[#203264]" : "text-slate-600 hover:bg-slate-50"}`}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" /><span>More</span>
        </button>}
      </div>
    </nav>
    <Dialog open={open} onClose={() => setOpen(false)} labelledBy={`${id}-title`}
      className="portal-navigation-sheet inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-b-none rounded-t-3xl p-4 sm:mx-auto sm:max-w-lg">
      <div id={id} className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-[#365FA6]">UPC Connect</p><h2 id={`${id}-title`} className="font-radio-canada text-xl font-semibold text-[#203264]">All workspaces</h2></div>
          <Button variant="ghost" type="button" data-dialog-initial-focus onClick={() => setOpen(false)}><X aria-hidden="true" />Close</Button>
        </div>
        <nav aria-label="More navigation" onClick={event => {
          if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
        }}>{children}</nav>
      </div>
    </Dialog>
  </>;
}
