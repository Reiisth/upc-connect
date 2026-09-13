"use client";

import { useMemo, useState } from "react";
import { Mail, Search, UsersRound } from "lucide-react";
import { useFormStatus } from "react-dom";

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
  action: (formData: FormData) => void | Promise<void>;
};

export default function InviteMembersForm({
  members,
  existingEmails,
  defaultEmail,
  defaultMemberId,
  action,
}: InviteMembersFormProps) {
  const [search, setSearch] = useState("");

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return members;

    return members.filter((member) => {
      const fullName = [
        member.first_name,
        member.middle_name,
        member.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        fullName.includes(query) ||
        member.account_status.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  return (
    <form action={action} className="space-y-7">
      {/* EMAIL */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#5D94E8]" />

          <label
            htmlFor="email"
            className="text-sm font-medium text-[#203264]"
          >
            Account Email
          </label>
        </div>

        <input
          id="email"
          name="email"
          type="email"
          list="existing-accounts"
          defaultValue={defaultEmail}
          placeholder="Search existing email or enter a new one"
          autoComplete="off"
          required
          className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
        />

        <datalist id="existing-accounts">
          {existingEmails.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>

        <p className="mt-2 text-xs text-muted-foreground">
          Existing accounts will be connected directly. New email addresses
          will receive an invitation.
        </p>
      </div>

      {/* MEMBER SEARCH */}
      <fieldset>
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-[#5D94E8]" />

          <legend className="text-sm font-medium text-[#203264]">
            Select Members
          </legend>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
          />
        </div>

        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border bg-[#F8FAFD] p-3">
          {filteredMembers.map((member) => {
            const fullName = [
              member.first_name,
              member.middle_name,
              member.last_name,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <label
                key={member.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 transition hover:bg-[#EEF3FB]"
              >
                <input
                  type="checkbox"
                  name="member_ids"
                  value={member.id}
                  defaultChecked={member.id === defaultMemberId}
                  className="h-4 w-4 rounded border-gray-300"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#203264]">
                    {fullName}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatStatus(member.account_status)}
                  </p>
                </div>
              </label>
            );
          })}

          {!filteredMembers.length && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No members found.
            </div>
          )}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <ConnectMembersButton />
      </div>
    </form>
  );
}

function ConnectMembersButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 rounded-xl bg-[#203264] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2C447D] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Connecting members...
        </>
      ) : (
        "Connect Members"
      )}
    </button>
  );
}

function formatStatus(value: string) {
  if (value === "connected") return "Connected";
  if (value === "invited") return "Invited";
  if (value === "no_account") return "No account";

  return value.replaceAll("_", " ");
}