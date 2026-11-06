"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableActionButton } from "@/components/ui/table-action-button";
import { finishService, previewServiceCompletion } from "./actions";
export default function ServiceLifecycleActions({id,status}:{id:string;status:string}) {
 const [target,setTarget]=useState<"completed"|"cancelled"|null>(null);
 const [summary,setSummary]=useState<Awaited<ReturnType<typeof previewServiceCompletion>>|null>(null);
 const [error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
 if (status!=="scheduled"&&status!=="ongoing") return null;
 return <>
  {status==="ongoing"&&<TableActionButton icon={<CheckCircle2 />} disabled={pending} onClick={()=>{setError("");setSummary(null);start(async()=>{try{setSummary(await previewServiceCompletion(id));setTarget("completed");}catch(e){setError(e instanceof Error?e.message:"Unable to review attendance.");}});}}>{pending?"Reviewing...":"Complete"}</TableActionButton>}
  <TableActionButton icon={<XCircle />} disabled={pending} onClick={()=>{setError("");setTarget("cancelled");}}>Cancel Service</TableActionButton>
  {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  <ConfirmActionModal open={target!==null} title={target==="completed"?"Complete Service?":"Cancel Service?"} description={target==="completed"?(summary?.missing?`${summary.missing} eligible members have no attendance record. Completing this service will mark all eligible members without a Present, Excused, or Absent attendance record as Absent.`:"All eligible members already have an attendance record."):"This is a terminal action. Attendance becomes read-only and the recorded history is preserved."} confirmLabel={target==="completed"?"Complete Service":"Cancel Service"} loading={pending} onClose={()=>{if(!pending)setTarget(null);}} onConfirm={()=>{if(!target)return;start(async()=>{try{await finishService(id,target);setTarget(null);router.refresh();}catch(e){setTarget(null);setError(e instanceof Error?e.message:"Unable to update Service.");}});}} >{target==="completed"&&summary&&<dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">{[["Present",summary.present],["Excused",summary.excused],["Absent already recorded",summary.absent],["No attendance record",summary.missing]].map(([label,count])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-[#203264]">{count}</dd></div>)}</dl>}</ConfirmActionModal>
 </>;
}
