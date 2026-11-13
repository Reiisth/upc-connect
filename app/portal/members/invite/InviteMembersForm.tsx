"use client";
import { FeedbackMessage } from "@/components/ui/feedback-message";


import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow, useRouter } from "next/navigation";
import { finishMemberConnection, type MemberConnectionResult } from "@/lib/member-connection";
import { Link2, Mail, Plus, UsersRound, X } from "lucide-react";
import MemberAutocomplete from "../../contributions/MemberAutocomplete";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import styles from "./connection-line.module.css";

type Member = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  account_status: string;
};

type InviteMembersFormProps = {
  members: Member[];
  existingEmails: string[];
  defaultEmail: string;
  defaultMemberId?: string;
  action: (formData: FormData) => Promise<MemberConnectionResult>;
};

export default function InviteMembersForm(props: InviteMembersFormProps) {
  const [session, setSession] = useState(0);
  useLayoutEffect(() => () => setSession(value => value + 1), []);
  return <InviteMembersFormSession key={session} {...props} />;
}

function InviteMembersFormSession({ action, ...props }: InviteMembersFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const finishAnimation = useRef<(() => void) | null>(null);
  const onAnimationComplete = useCallback(() => finishAnimation.current?.(), []);
  async function connect(formData: FormData) {
    setError("");
    const animation = new Promise<void>(resolve => { finishAnimation.current = resolve; });
    try {
      const result = await finishMemberConnection(() => action(formData), animation);
      if (result.error) setError(result.error);
      else if (result.redirectTo) {
        setCompleted(true);
        router.push(result.redirectTo);
      }
    } catch (error) {
      unstable_rethrow(error);
      setError("Unable to connect these members. Check the account email and member selections, then try again.");
    } finally {
      finishAnimation.current = null;
    }
  }
  return <form action={connect} className="space-y-5">
    <ConnectionFields {...props} error={error} completed={completed} onAnimationComplete={onAnimationComplete} />
  </form>;
}

function ConnectionFields({ members, existingEmails, defaultEmail, defaultMemberId, error, completed, onAnimationComplete }: Omit<InviteMembersFormProps, "action"> & { error: string; completed: boolean; onAnimationComplete: () => void }) {
  const { pending: submitting } = useFormStatus();
  const pending = submitting || completed;
  useEffect(() => {
    if (submitting && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(onAnimationComplete);
      return () => cancelAnimationFrame(frame);
    }
  }, [submitting, onAnimationComplete]);
  const prefilledMember = members.find(member => member.id === defaultMemberId);
  const [email, setEmail] = useState(defaultEmail);
  const [rows, setRows] = useState([{ key: 0, memberId: prefilledMember?.id ?? "" }]);
  const nextKey = useRef(1);
  const hasEmail = Boolean(email.trim());
  const options = members.map(member => ({
    id: member.id,
    fullName: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" "),
    churchBranchId: "",
    isArchived: false,
  }));
  const ready = hasEmail && rows.every(row => Boolean(row.memberId));

  return <>
    <div className="grid items-start gap-0 lg:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]">
      <FormSection className="lg:self-center" title="Account" icon={<Mail />} description="Choose an existing account or invite someone new.">
        <FormField label="Account email" htmlFor="connection-email" required description="New email addresses receive an invitation. Existing accounts are connected directly.">
          <Input id="connection-email" name="email" type="email" list="existing-accounts" value={email}
            onChange={event => setEmail(event.target.value)} placeholder="Enter or search an email address"
            autoComplete="off" required disabled={pending} />
          <datalist id="existing-accounts">{existingEmails.map(value => <option key={value} value={value} />)}</datalist>
        </FormField>
      </FormSection>

      <div className={`${styles.connector} lg:self-stretch`} data-connecting={pending} role="img"
        aria-label={pending ? "Connecting account and members" : "Account to member connection"}>
        <span className={styles.track} />
        <span className={`${styles.light} ${styles.fromAccount}`} />
        <span className={`${styles.light} ${styles.fromMembers}`} />
        <span className={styles.middle} onAnimationEnd={event => { if (event.target === event.currentTarget) onAnimationComplete(); }}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <FormSection title="Member profiles" icon={<UsersRound />} description="Search for each member you want this account to manage.">
        {!members.length ? <p role="status" className="text-sm text-slate-500">No unconnected members are available in your accessible branches.</p> : <>
          <div className="space-y-4">
            {rows.map((row, index) => {
              const disabled = pending || (!hasEmail && !(row.key === 0 && prefilledMember));
              const available = options.filter(option => option.id === row.memberId || !rows.some(other => other.memberId === option.id));
              return <div key={row.key} className="flex items-start gap-2">
                <FormField label={`Member ${index + 1}`} htmlFor={`connection-member-${row.key}`} required className="min-w-0 flex-1"
                  description={!hasEmail && row.key === 0 ? prefilledMember ? "Selected from the member page. Enter an email to connect." : "Enter an account email to search members." : undefined}>
                  <MemberAutocomplete id={`connection-member-${row.key}`} members={available} value={row.memberId}
                    name="member_ids" disabled={disabled} showContext={false}
                    onChange={memberId => setRows(current => current.map(item => item.key === row.key ? { ...item, memberId } : item))} />
                </FormField>
                {rows.length > 1 && <Button type="button" variant="ghost" size="icon" className="mt-7 shrink-0"
                  disabled={pending} aria-label={`Remove member ${index + 1}`} title="Remove member"
                  onClick={() => setRows(current => current.filter(item => item.key !== row.key))}><X /></Button>}
              </div>;
            })}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pending || !hasEmail || rows.length >= members.length}
            onClick={() => { const key = nextKey.current++; setRows(current => [...current, { key, memberId: "" }]); }}>
            <Plus />Add member
          </Button>
        </>}
      </FormSection>
    </div>
    {error && !pending && <FeedbackMessage>{error}</FeedbackMessage>}
    <FormActions>
      <p role="status" aria-live="polite" className="self-center text-sm text-slate-500 sm:mr-auto">
        {pending ? "Connecting account and member profiles..." : "Each member can be connected to one account."}
      </p>
      <Button type="submit" disabled={!ready || !members.length || pending} loading={pending} pendingLabel="Connecting members...">
        <Link2 />Connect Members
      </Button>
    </FormActions>
  </>;
}
