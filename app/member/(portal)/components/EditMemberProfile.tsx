"use client";

import { useMember } from "./MemberProvider";
import MemberProfileForm from "../../complete-profile/[memberId]/member-profile-form";
import { updateMemberProfile } from "../edit-profile/actions";

type FieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_builtin: boolean;
  is_required: boolean;
  is_visible: boolean;
  options: unknown;
  sort_order: number;
};

type Branch = {
  id: string;
  name: string;
};

type Department = {
  id: string;
  name: string;
};

type EditMemberProfileProps = {
  branches: Branch[];
  departments: Department[];
  fieldDefinitions: FieldDefinition[];
};

export default function EditMemberProfile({
  branches,
  departments,
  fieldDefinitions,
}: EditMemberProfileProps) {
  const { member } = useMember();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-[#5D94E8]">
          Member Profile
        </p>

        <h1 className="mt-1 font-heading text-2xl font-semibold text-[#203264]">
          EDIT INFORMATION
        </h1>
      </div>

      <MemberProfileForm
        key={member.id}
        member={member}
        accountEmail={member.email ?? ""}
        branches={branches}
        departments={departments}
        fieldDefinitions={fieldDefinitions}
        action={updateMemberProfile}
      />
    </div>
  );
}