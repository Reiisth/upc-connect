"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableActionButton } from "@/components/ui/table-action-button";
import { finishService } from "./actions";
export default function ServiceLifecycleActions({id,status}:{id:string;status:string}) {
 const [target,setTarget]=useState<"completed"|"cancelled"|null>(null);
 const [error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
 if (status!=="scheduled"&&status!=="ongoing") return null;
 return <>
  {status==="ongoing"&&<TableActionButton icon={<CheckCircle2 />} onClick={()=>setTarget("completed")}>Complete</TableActionButton>}
  <TableActionButton icon={<XCircle />} onClick={()=>setTarget("cancelled")}>Cancel Service</TableActionButton>
  {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  <ConfirmActionModal open={target!==null} title={target==="completed"?"Complete Service?":"Cancel Service?"} description="This is a terminal action. Attendance becomes read-only and the recorded history is preserved." confirmLabel={target==="completed"?"Complete Service":"Cancel Service"} loading={pending} onClose={()=>{if(!pending)setTarget(null);}} onConfirm={()=>{if(!target)return;start(async()=>{try{await finishService(id,target);setTarget(null);router.refresh();}catch(e){setTarget(null);setError(e instanceof Error?e.message:"Unable to update Service.");}});}} />
 </>;
}
