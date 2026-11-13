"use client";
import { FeedbackMessage } from "@/components/ui/feedback-message";


import Link from "next/link";
import MemberAutocomplete from "../contributions/MemberAutocomplete";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES, METHOD_LABELS, OUTCOME_LABELS,
  type FollowUpAction, type FollowUpBranch, type FollowUpMember, type FollowUpValues } from "./types";

export default function FollowUpForm({ branches, members, initialValues, action, immutable = false, cancelHref }: {
  branches: FollowUpBranch[]; members: FollowUpMember[];
  initialValues: FollowUpValues; action: FollowUpAction; immutable?: boolean;
  cancelHref: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, formAction, pending] = useActionState(action, { error: null });
  function field<K extends keyof FollowUpValues>(key: K, value: FollowUpValues[K]) { setValues((current) => ({ ...current, [key]: value })); }
  const branchMembers = members.filter((member) => member.branchId === values.branchId);

  return (
    <form action={formAction}>
      <FormSection title="Follow-up Details">
        {state.error && <FeedbackMessage>{state.error}</FeedbackMessage>}
        <fieldset disabled={pending} className="grid gap-5 md:grid-cols-2">
          {immutable ? (
            <>
              <input type="hidden" name="church_branch_id" value={values.branchId} />
              <input type="hidden" name="member_id" value={values.memberId} />
              <FormField label="Branch" htmlFor="follow-up-branch"><Input id="follow-up-branch" readOnly value={branches.find((b) => b.id === values.branchId)?.name ?? "Historical branch"} /></FormField>
              <FormField label="Member" htmlFor="follow-up-member" description="Historical member and branch cannot be changed, including after a transfer.">
                <Input id="follow-up-member" readOnly value={members.find((m) => m.id === values.memberId)?.name ?? "Historical member"} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Branch" htmlFor="follow-up-branch" required>
                <Select id="follow-up-branch" name="church_branch_id" required value={values.branchId} onChange={(event) => setValues((current) => ({ ...current, branchId: event.target.value, memberId: "" }))}>
                  <option value="" disabled>Select a branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? ` (${branch.code})` : ""}</option>)}
                </Select>
              </FormField>
              <FormField label="Member" htmlFor="follow-up-member" required description="Follow-ups may be recorded regardless of the member’s activity status.">
                <MemberAutocomplete key={values.branchId} id="follow-up-member"
                  members={branchMembers.map(member => ({ id: member.id,
                    fullName: `${member.name}${member.isArchived ? " (Archived)" : ""}`,
                    churchBranchId: member.branchId ?? "", isArchived: member.isArchived }))}
                  value={values.memberId} onChange={memberId => field("memberId", memberId)}
                  branchId={values.branchId} showContext={false} />
              </FormField>
            </>
          )}
          <FormField label="Follow-up Date" htmlFor="follow-up-date" required>
            <Input id="follow-up-date" name="follow_up_date" type="date" required value={values.followUpDate} onChange={(event) => field("followUpDate", event.target.value)} />
          </FormField>
          <FormField label="Method" htmlFor="follow-up-method" required>
            <Select id="follow-up-method" name="method" value={values.method} onChange={(event) => field("method", event.target.value as FollowUpValues["method"])}>
              {FOLLOW_UP_METHODS.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
            </Select>
          </FormField>
          <FormField label="Outcome" htmlFor="follow-up-outcome" required>
            <Select id="follow-up-outcome" name="outcome" value={values.outcome} onChange={(event) => field("outcome", event.target.value as FollowUpValues["outcome"])}>
              {FOLLOW_UP_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{OUTCOME_LABELS[outcome]}</option>)}
            </Select>
          </FormField>
          <FormField label="Followed Up By" htmlFor="follow-up-performer" description="Leave blank to use the original recorder?s display name.">
            <Input id="follow-up-performer" name="followed_up_by" maxLength={120} placeholder="Name of the person who followed up" value={values.followedUpBy} onChange={(event) => field("followedUpBy", event.target.value)} />
          </FormField>
          <FormField label="Next Follow-up Date" htmlFor="follow-up-next" description="Optional for any outcome. Must be on or after the follow-up date.">
            <Input id="follow-up-next" name="next_follow_up_date" type="date" min={values.followUpDate || undefined} value={values.nextFollowUpDate} onChange={(event) => field("nextFollowUpDate", event.target.value)} />
          </FormField>
          <FormField label="Notes" htmlFor="follow-up-notes" className="md:col-span-2">
            <Textarea id="follow-up-notes" name="notes" rows={5} maxLength={5000} value={values.notes} onChange={(event) => field("notes", event.target.value)} placeholder="Record the contact and any useful context." />
          </FormField>
        </fieldset>
        <FormActions>
          <Button variant="outline" asChild><Link href={cancelHref}>Cancel</Link></Button>
          <Button type="submit" disabled={pending || !values.memberId}>{pending ? "Saving…" : immutable ? "Save Changes" : "Record Follow-up"}</Button>
        </FormActions>
      </FormSection>
    </form>
  );
}
