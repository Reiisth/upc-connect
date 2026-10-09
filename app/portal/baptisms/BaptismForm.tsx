"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  BAPTISM_TYPES,
  formatBaptismType,
  initialBaptismActionState,
  isActiveMember,
  type BaptismAction,
  type BaptismBranch,
  type BaptismFormValues,
  type BaptismMemberOption,
} from "./types";

type BaptismFormProps = {
  branches: BaptismBranch[];
  members: BaptismMemberOption[];
  action: BaptismAction;
  submitLabel: string;
  values?: BaptismFormValues;
};

const defaultValues: BaptismFormValues = {
  memberId: "",
  baptismType: "water",
  baptismDate: "",
  churchBranchId: "",
  officiatedBy: "",
  location: "",
  notes: "",
};

export function BaptismForm({
  branches,
  members,
  action,
  submitLabel,
  values,
}: BaptismFormProps) {
  const formValues = values ?? defaultValues;
  const [branchId, setBranchId] = useState(
    formValues.churchBranchId,
  );
  const [memberId, setMemberId] = useState(
    formValues.memberId,
  );
  const [baptismType, setBaptismType] = useState(
    formValues.baptismType,
  );
  const [baptismDate, setBaptismDate] = useState(
    formValues.baptismDate,
  );
  const [officiatedBy, setOfficiatedBy] = useState(
    formValues.officiatedBy,
  );
  const [location, setLocation] = useState(formValues.location);
  const [notes, setNotes] = useState(formValues.notes);
  const [actionState, formAction] = useActionState(
    action,
    initialBaptismActionState,
  );

  const existingMemberId = values?.memberId ?? null;
  const branchMembers = members.filter(
    (member) =>
      member.churchBranchId === branchId &&
      (member.id === existingMemberId || isActiveMember(member)),
  );
  const existingHistoricalMember = members.find(
    (member) =>
      member.id === existingMemberId && !isActiveMember(member),
  );

  function handleBranchChange(nextBranchId: string) {
    setBranchId(nextBranchId);

    if (
      memberId &&
      !members.some(
        (member) =>
          member.id === memberId &&
          member.churchBranchId === nextBranchId,
      )
    ) {
      setMemberId("");
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {actionState.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
        >
          <p className="font-semibold">Unable to save baptism record</p>
          <p className="mt-1">{actionState.error}</p>
        </div>
      )}

      <FormSection
        title="Baptism Information"
        description="Record one water baptism or Holy Ghost baptism for an active member of an assigned branch."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Church Branch"
            htmlFor="baptism-branch"
            required
            className="md:col-span-2"
            description="Only active branches available to your account are listed."
          >
            <Select
              id="baptism-branch"
              name="church_branch_id"
              value={branchId}
              onChange={(event) =>
                handleBranchChange(event.target.value)
              }
              required
              disabled={branches.length === 0}
            >
              <option value="" disabled>
                Select a church branch
              </option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.code ? ` (${branch.code})` : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Member"
            htmlFor="baptism-member"
            required
            className="md:col-span-2"
            description="Only active members are available for new records."
          >
            {existingHistoricalMember && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                This record preserves a historical link to an inactive or
                archived member. You may leave the member unchanged.
              </p>
            )}

            <Select
              id="baptism-member"
              name="member_id"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              disabled={!branchId || branchMembers.length === 0}
              required
            >
              <option value="" disabled>
                Select a member
              </option>

              {branchMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                  {!isActiveMember(member)
                    ? " (Historical link)"
                    : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Baptism Type"
            htmlFor="baptism-type"
            required
            description="Each member may have one record of each type."
          >
            <Select
              id="baptism-type"
              name="baptism_type"
              value={baptismType}
              onChange={(event) =>
                setBaptismType(
                  event.target.value as BaptismFormValues["baptismType"],
                )
              }
              required
            >
              {BAPTISM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatBaptismType(type)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Baptism Date"
            htmlFor="baptism-date"
            description="Optional. Leave blank when the historical date is unknown."
          >
            <Input
              id="baptism-date"
              name="baptism_date"
              type="date"
              value={baptismDate}
              onChange={(event) =>
                setBaptismDate(event.target.value)
              }
            />
          </FormField>

          <FormField
            label="Officiated By"
            htmlFor="baptism-officiated-by"
            description="Free-text officiant name for now."
          >
            <Input
              id="baptism-officiated-by"
              name="officiated_by"
              type="text"
              maxLength={200}
              value={officiatedBy}
              onChange={(event) =>
                setOfficiatedBy(event.target.value)
              }
              placeholder="e.g. Pastor Juan Dela Cruz"
            />
          </FormField>

          <FormField
            label="Location"
            htmlFor="baptism-location"
            description="The physical baptism location may differ from the owning branch."
          >
            <Input
              id="baptism-location"
              name="location"
              type="text"
              maxLength={200}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. UPC Main Sanctuary"
            />
          </FormField>

          <FormField
            label="Notes"
            htmlFor="baptism-notes"
            className="md:col-span-2"
            description="Optional notes for the spiritual ministry record."
          >
            <Textarea
              id="baptism-notes"
              name="notes"
              rows={5}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any helpful notes..."
            />
          </FormField>
        </div>

        <FormActions>
          <Button variant="outline" asChild>
            <Link href="/portal/baptisms">Cancel</Link>
          </Button>

          <BaptismSubmitButton label={submitLabel} />
        </FormActions>
      </FormSection>
    </form>
  );
}

function BaptismSubmitButton({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}
