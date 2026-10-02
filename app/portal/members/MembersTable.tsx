"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { disconnectMember, archiveMember } from "./actions";
import ConfirmActionModal from "./ConfirmActionModal";
import { Archive, MailPlus, Unplug } from "lucide-react";

type Member = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  account_status: string;
  profile_status: string;
};

type MembersTableProps = {
  members: Member[];
};

function ArchiveMemberButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    setLoading(true);

    try {
      await archiveMember(memberId);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-slate-700 hover:underline"
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </button>

      <ConfirmActionModal
        open={open}
        title="Archive member?"
        description={`${memberName} will be removed from the active members list, but their profile, attendance, contributions, and other historical records will be preserved.`}
        confirmLabel="Archive"
        loadingLabel="Archiving..."
        loading={loading}
        onConfirm={handleArchive}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </>
  );
}

export default function MembersTable({ members }: MembersTableProps) {
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
        member.email?.toLowerCase().includes(query) ||
        member.account_status.toLowerCase().includes(query) ||
        member.profile_status.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  return (
    <>
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search members..."
          className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Account Status</th>
              <th className="px-5 py-4">Profile Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {filteredMembers.map((member) => {
              const fullName = [
                member.first_name,
                member.middle_name,
                member.last_name,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={member.id}>
                  <td className="px-5 py-4 font-medium text-[#203264]">
                    {fullName}
                  </td>

                  <td className="px-5 py-4">
                    {member.email ?? "—"}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge
                      type="account"
                      value={member.account_status}
                    />
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge
                      type="profile"
                      value={member.profile_status}
                    />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-col items-start gap-2">
                      {member.account_status === "no_account" ? (
                        <Link
                          href={`/portal/members/invite?memberId=${member.id}`}
                          className="inline-flex items-center gap-1.5 font-medium text-[#5D94E8] transition hover:text-[#4B82D6] hover:underline"
                        >
                          <MailPlus className="h-3.5 w-3.5" />
                          Connect Email
                        </Link>
                      ) : (
                        <DisconnectMemberButton
                          memberId={member.id}
                          memberName={`${member.first_name} ${member.last_name}`}
                        />
                      )}

                      <ArchiveMemberButton
                        memberId={member.id}
                        memberName={`${member.first_name} ${member.last_name}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filteredMembers.length && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-muted-foreground"
                >
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DisconnectMemberButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);

    try {
      await disconnectMember(memberId);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-medium text-red-600 transition hover:text-red-700 hover:underline"
      >
        <Unplug className="h-3.5 w-3.5" />
        Disconnect
      </button>

      <ConfirmActionModal
        open={open}
        title="Disconnect member?"
        description={`${memberName} will no longer be linked to their current login account. Their member profile and records will remain in the system.`}
        confirmLabel="Disconnect"
        loadingLabel="Disconnecting..."
        loading={loading}
        destructive
        onConfirm={handleDisconnect}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </>
  );
}
function StatusBadge({
  type,
  value,
}: {
  type: "account" | "profile";
  value: string;
}) {
  let styles = "bg-gray-100 text-gray-700";
  let label = value.replaceAll("_", " ");

  if (type === "account") {
    if (value === "connected") {
      styles = "bg-green-100 text-green-700";
      label = "Connected";
    } else if (value === "invited") {
      styles = "bg-amber-100 text-amber-700";
      label = "Invited";
    } else if (value === "no_account") {
      styles = "bg-slate-100 text-slate-600";
      label = "No Account";
    }
  }

  if (type === "profile") {
    if (value === "completed") {
      styles = "bg-blue-100 text-blue-700";
      label = "Completed";
    } else if (value === "incomplete") {
      styles = "bg-rose-100 text-rose-700";
      label = "Incomplete";
    }
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}