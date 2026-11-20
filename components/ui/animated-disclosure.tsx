"use client";
import { useId, useState, type ReactNode } from "react";

export function AnimatedDisclosure({trigger,actions,children}:{trigger:ReactNode;actions?:ReactNode;children:ReactNode}) {
  const [open,setOpen]=useState(false);
  const id=useId();
  return <div className="group/services" data-state={open ? "open" : "closed"}>
    <div className="flex flex-wrap items-center gap-2">
    <button id={`${id}-trigger`} type="button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={()=>setOpen(value=>!value)}
      className="inline-flex min-h-11 items-center rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6]">{trigger}</button>
    {actions}
    </div>
    <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open}
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out ${open ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] -translate-y-1 opacity-0"}`}>
      <div className="min-h-0 overflow-hidden"><div className="space-y-3 pt-2">{children}</div></div>
    </div>
  </div>;
}
