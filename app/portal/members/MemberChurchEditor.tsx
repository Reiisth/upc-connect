"use client";
import { FeedbackMessage } from "@/components/ui/feedback-message";


import { useActionState, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Church, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberChurchForm } from "./MemberChurchForm";
import { saveMemberChurchInformation } from "./actions";

type Props = Pick<ComponentProps<typeof MemberChurchForm>, "member" | "branches" | "departments"> & { memberId: string; canEdit: boolean; children: ReactNode };
export default function MemberChurchEditor({ memberId, canEdit, children, ...options }: Props) {
  const [editing, setEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [state, action, pending] = useActionState(async (previous: { error: string | null; saved?: boolean }, form: FormData) => {
    setShowSaved(false);
    const result = await saveMemberChurchInformation(memberId, previous, form);
    if (result.saved) { setEditing(false); setShowSaved(true); }
    return result;
  }, { error: null });
  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 4000);
    return () => { clearTimeout(timer); setShowSaved(false); };
  }, [showSaved]);
  return <Card><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex items-center gap-1">
      <h2 className="flex items-center gap-2 font-semibold text-[#203264]"><Church className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />Church Information</h2>
      {canEdit && !editing && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full [&_svg]:size-3.5" title="Edit church information" aria-label="Edit church information" onClick={() => { setShowSaved(false); setEditing(true); }}><Pencil aria-hidden="true" /></Button>}
    </div>
    {editing ? <>
      <MemberChurchForm {...options} embedded editing action={action} onCancel={() => setEditing(false)} pending={pending} />
      {state.error && <FeedbackMessage>{state.error}</FeedbackMessage>}
    </> : <>{showSaved && <p role="status" className="text-sm text-emerald-700">Church information saved.</p>}{children}</>}
  </CardContent></Card>;
}
