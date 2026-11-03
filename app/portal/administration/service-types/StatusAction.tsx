"use client";
import { useState, useTransition } from "react";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { setServiceTypeActive } from "./actions";
export function StatusAction({ typeKey, name, active }: { typeKey: string; name: string; active: boolean }) {
  const [open,setOpen]=useState(false); const [pending,startTransition]=useTransition();
  return <><button type="button" className="text-sm text-[#365FA6] hover:underline" onClick={()=>setOpen(true)}>{active?"Deactivate":"Reactivate"}</button><ConfirmActionModal open={open} title={active?"Deactivate Service Type":"Reactivate Service Type"} description={active?`${name} will no longer be available for new Services. Existing Services and Attendance history will be preserved.`:`${name} will be available for new Services again.`} confirmLabel={active?"Deactivate":"Reactivate"} destructive={active} loading={pending} onClose={()=>setOpen(false)} onConfirm={()=>startTransition(async()=>{await setServiceTypeActive(typeKey,!active);setOpen(false);})}/></>;
}
