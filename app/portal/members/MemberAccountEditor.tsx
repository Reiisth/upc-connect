"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Link2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { saveLinkedAccount } from "./account-actions";

export default function MemberAccountEditor({ memberId, displayName, canEditName, children, badge }: {
  memberId: string; displayName: string; canEditName: boolean; children: ReactNode; badge: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [state, action, pending] = useActionState(async (previous: { error: string | null; saved?: boolean }, form: FormData) => {
    setShowSaved(false);
    const result = await saveLinkedAccount(memberId, previous, form);
    if (result.saved) { setEditing(false); setShowSaved(true); }
    return result;
  }, { error: null });
  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 4000);
    return () => { clearTimeout(timer); setShowSaved(false); };
  }, [showSaved]);
  return <Card><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1">
      <h2 className="flex items-center gap-2 font-semibold text-[#203264]"><Link2 className="h-4 w-4 text-[#5D94E8]" aria-hidden="true" />Account</h2>
      {canEditName && !editing && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full [&_svg]:size-3.5" aria-label="Edit account information" title="Edit account information" onClick={() => { setShowSaved(false); setEditing(true); }}><Pencil aria-hidden="true" /></Button>}
    </div>{badge}</div>
    {editing ? <form action={action} className="space-y-4">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display Name" htmlFor="account-display-name"><Input id="account-display-name" name="display_name" required maxLength={200} defaultValue={displayName} readOnly={!canEditName} /></FormField>
      </fieldset>
      <p className="text-xs text-slate-500">These changes apply to the linked login account and all its member profiles.</p>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <FormActions><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save Changes"}</Button></FormActions>
    </form> : <>{showSaved && <p role="status" className="text-sm text-emerald-700">Account information saved.</p>}<dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2"><div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Display Name</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{displayName || "Not provided"}</dd></div>{children}</dl></>}
  </CardContent></Card>;
}
