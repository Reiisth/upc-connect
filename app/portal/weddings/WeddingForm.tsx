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
  initialWeddingActionState,
  isActiveWeddingMember,
  type WeddingAction,
  type WeddingBranch,
  type WeddingFormValues,
  type WeddingMemberOption,
  type WeddingSpouseSource,
} from "./types";

type WeddingFormProps = {
  branches: WeddingBranch[];
  members: WeddingMemberOption[];
  action: WeddingAction;
  submitLabel: string;
  values?: WeddingFormValues;
};

const defaultValues: WeddingFormValues = {
  memberId: "",
  spouseSource: "member",
  spouseMemberId: null,
  spouseName: "",
  weddingDate: "",
  churchBranchId: "",
  officiatedBy: "",
  location: "",
  certificateNumber: "",
  notes: "",
};

export function WeddingForm({
  branches,
  members,
  action,
  submitLabel,
  values,
}: WeddingFormProps) {
  const formValues = values ?? defaultValues;
  const [branchId, setBranchId] = useState(
    formValues.churchBranchId,
  );
  const [memberId, setMemberId] = useState(formValues.memberId);
  const [spouseSource, setSpouseSource] = useState<WeddingSpouseSource>(
    formValues.spouseSource,
  );
  const [spouseMemberId, setSpouseMemberId] = useState(
    formValues.spouseMemberId ?? "",
  );
  const [spouseName, setSpouseName] = useState(formValues.spouseName);
  const [weddingDate, setWeddingDate] = useState(
    formValues.weddingDate,
  );
  const [officiatedBy, setOfficiatedBy] = useState(
    formValues.officiatedBy,
  );
  const [location, setLocation] = useState(formValues.location);
  const [certificateNumber, setCertificateNumber] = useState(
    formValues.certificateNumber,
  );
  const [notes, setNotes] = useState(formValues.notes);
  const [actionState, formAction] = useActionState(
    action,
    initialWeddingActionState,
  );

  const historicalMemberIds = new Set(
    [formValues.memberId, formValues.spouseMemberId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const branchMembers = members.filter(
    (member) =>
      member.churchBranchId === branchId &&
      (isActiveWeddingMember(member) || historicalMemberIds.has(member.id)),
  );
  const primaryMemberOptions = branchMembers;
  const spouseMemberOptions = branchMembers.filter(
    (member) => member.id !== memberId,
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

    if (
      spouseMemberId &&
      !members.some(
        (member) =>
          member.id === spouseMemberId &&
          member.churchBranchId === nextBranchId,
      )
    ) {
      setSpouseMemberId("");
    }
  }

  function handleMemberChange(nextMemberId: string) {
    setMemberId(nextMemberId);

    if (nextMemberId === spouseMemberId) {
      setSpouseMemberId("");
    }
  }

  function handleSpouseSourceChange(nextSource: WeddingSpouseSource) {
    setSpouseSource(nextSource);

    if (nextSource === "member") {
      setSpouseName("");
    } else {
      setSpouseMemberId("");
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
          <p className="font-semibold">Unable to save wedding record</p>
          <p className="mt-1">{actionState.error}</p>
        </div>
      )}

      <FormSection
        title="Wedding Information"
        description="Record a wedding for a primary member and preserve whether the spouse is also in the member database."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Church Branch"
            htmlFor="wedding-branch"
            required
            className="md:col-span-2"
            description="Only active branches available to your account are listed."
          >
            <Select
              id="wedding-branch"
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
            label="Primary Member"
            htmlFor="wedding-member"
            required
            className="md:col-span-2"
            description="New records use active members. Existing inactive or archived links remain available when editing."
          >
            <Select
              id="wedding-member"
              name="member_id"
              value={memberId}
              onChange={(event) =>
                handleMemberChange(event.target.value)
              }
              disabled={!branchId || primaryMemberOptions.length === 0}
              required
            >
              <option value="" disabled>
                Select the primary member
              </option>

              {primaryMemberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                  {!isActiveWeddingMember(member)
                    ? " (Historical link)"
                    : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Spouse Source"
            htmlFor="wedding-spouse-source"
            required
            className="md:col-span-2"
            description="Choose an existing member or record the spouse as an external name."
          >
            <Select
              id="wedding-spouse-source"
              name="spouse_source"
              value={spouseSource}
              onChange={(event) =>
                handleSpouseSourceChange(
                  event.target.value as WeddingSpouseSource,
                )
              }
              required
            >
              <option value="member">Spouse is an existing member</option>
              <option value="external">
                Spouse is not in the member database
              </option>
            </Select>
          </FormField>

          {spouseSource === "member" ? (
            <FormField
              label="Spouse Member"
              htmlFor="wedding-spouse-member"
              required
              className="md:col-span-2"
              description="The primary member cannot be selected as their own spouse."
            >
              <Select
                id="wedding-spouse-member"
                name="spouse_member_id"
                value={spouseMemberId}
                onChange={(event) =>
                  setSpouseMemberId(event.target.value)
                }
                disabled={!branchId || spouseMemberOptions.length === 0}
                required
              >
                <option value="" disabled>
                  Select the spouse member
                </option>

                {spouseMemberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                    {!isActiveWeddingMember(member)
                      ? " (Historical link)"
                      : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField
              label="Spouse Name"
              htmlFor="wedding-spouse-name"
              required
              className="md:col-span-2"
              description="Enter the spouse's name as it should appear in the historical record."
            >
              <input
                type="hidden"
                name="spouse_member_id"
                value=""
              />
              <Input
                id="wedding-spouse-name"
                name="spouse_name"
                type="text"
                maxLength={200}
                value={spouseName}
                onChange={(event) => setSpouseName(event.target.value)}
                placeholder="e.g. Maria Santos"
                required
              />
            </FormField>
          )}

          <FormField
            label="Wedding Date"
            htmlFor="wedding-date"
            required
          >
            <Input
              id="wedding-date"
              name="wedding_date"
              type="date"
              value={weddingDate}
              onChange={(event) => setWeddingDate(event.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Officiated By"
            htmlFor="wedding-officiated-by"
            description="Optional free-text officiant name."
          >
            <Input
              id="wedding-officiated-by"
              name="officiated_by"
              type="text"
              maxLength={200}
              value={officiatedBy}
              onChange={(event) => setOfficiatedBy(event.target.value)}
              placeholder="e.g. Pastor Juan Dela Cruz"
            />
          </FormField>

          <FormField
            label="Location"
            htmlFor="wedding-location"
            description="Optional location for the historical record."
          >
            <Input
              id="wedding-location"
              name="location"
              type="text"
              maxLength={200}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. UPC Main Sanctuary"
            />
          </FormField>

          <FormField
            label="Certificate Number"
            htmlFor="wedding-certificate-number"
            description="Optional certificate or registry reference."
          >
            <Input
              id="wedding-certificate-number"
              name="certificate_number"
              type="text"
              maxLength={200}
              value={certificateNumber}
              onChange={(event) =>
                setCertificateNumber(event.target.value)
              }
              placeholder="e.g. WED-2026-001"
            />
          </FormField>

          <FormField
            label="Notes"
            htmlFor="wedding-notes"
            className="md:col-span-2"
            description="Optional notes for the church record."
          >
            <Textarea
              id="wedding-notes"
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
            <Link href="/portal/weddings">Cancel</Link>
          </Button>

          <WeddingSubmitButton label={submitLabel} />
        </FormActions>
      </FormSection>
    </form>
  );
}

function WeddingSubmitButton({
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
