"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { disconnectMember, archiveMember } from "./actions";
import ConfirmActionModal from "./ConfirmActionModal";
import { Archive, MailPlus, Unplug } from "lucide-react";
import MemberCardModal from "./MemberCardModal";

type Member = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  nickname: string | null;
  birth_date: string | null;
  gender: string | null;
  phone_number: string | null;
  email: string | null;
  zone: number | null;
  civil_status: string | null;
  street_address: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  photo_url: string | null;
  position: string | null;

  member_status: string;
  account_status: string;
  profile_status: string;
  created_at: string;

  department:
  | {
    name: string;
  }
  | null;

  church_branch:
  | {
    name: string;
  }
  | null;
};

type MembersTableProps = {
  members: Member[];
  canManage: boolean;
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

export default function MembersTable({
  members,
  canManage
}: MembersTableProps) {
  const [search, setSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const [profileStatusFilter, setProfileStatusFilter] = useState("all");
  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = members.filter((member) => {
      const fullName = [
        member.first_name,
        member.middle_name,
        member.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.member_status.toLowerCase().includes(query) ||
        member.account_status.toLowerCase().includes(query) ||
        member.profile_status.toLowerCase().includes(query);

      const matchesMemberStatus =
        memberStatusFilter === "all" ||
        member.member_status === memberStatusFilter;

      const matchesAccountStatus =
        accountStatusFilter === "all" ||
        member.account_status === accountStatusFilter;

      const matchesProfileStatus =
        profileStatusFilter === "all" ||
        member.profile_status === profileStatusFilter;

      return (
        matchesSearch &&
        matchesMemberStatus &&
        matchesAccountStatus &&
        matchesProfileStatus
      );
    });

    return [...filtered].sort((a, b) => {
      const nameA = `${a.first_name} ${a.middle_name ?? ""} ${a.last_name}`
        .trim()
        .toLowerCase();

      const nameB = `${b.first_name} ${b.middle_name ?? ""} ${b.last_name}`
        .trim()
        .toLowerCase();

      switch (sortBy) {
        case "name_asc":
          return nameA.localeCompare(nameB);

        case "name_desc":
          return nameB.localeCompare(nameA);

        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "active_first":
          return a.member_status === b.member_status
            ? 0
            : a.member_status === "active"
              ? -1
              : 1;

        case "inactive_first":
          return a.member_status === b.member_status
            ? 0
            : a.member_status === "inactive"
              ? -1
              : 1;

        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });
  }, [
    members,
    search,
    memberStatusFilter,
    accountStatusFilter,
    profileStatusFilter,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / itemsPerPage),
  );

  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    memberStatusFilter,
    accountStatusFilter,
    profileStatusFilter,
    sortBy,
  ]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
          />
        </div>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8]"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="active_first">Active First</option>
          <option value="inactive_first">Inactive First</option>
        </select>

        <select
          value={memberStatusFilter}
          onChange={(event) => setMemberStatusFilter(event.target.value)}
          className="rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8]"
        >
          <option value="all">All Member Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={accountStatusFilter}
          onChange={(event) => setAccountStatusFilter(event.target.value)}
          className="rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8]"
        >
          <option value="all">All Account Statuses</option>
          <option value="connected">Connected</option>
          <option value="invited">Invited</option>
          <option value="no_account">No Account</option>
        </select>

        <select
          value={profileStatusFilter}
          onChange={(event) => setProfileStatusFilter(event.target.value)}
          className="rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8]"
        >
          <option value="all">All Profile Statuses</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="border-b bg-[#F8FAFD] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Member Status</th>
              <th className="px-5 py-4">Account Status</th>
              <th className="px-5 py-4">Profile Status</th>
              {canManage && (
                <th className="px-5 py-4">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y">
            {paginatedMembers.map((member) => {
              const fullName = [
                member.first_name,
                member.middle_name,
                member.last_name,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={member.id}>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedMember(member)}
                      className="font-medium text-[#203264] transition hover:text-[#5D94E8] hover:underline"
                    >
                      {fullName}
                    </button>
                  </td>

                  <td className="px-5 py-4">
                    {member.email ?? "—"}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge
                      type="member"
                      value={member.member_status}
                    />
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
                  {canManage && (
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
                  )}
                </tr>
              );
            })}

            {!filteredMembers.length && (
              <tr>
                <td
                  colSpan={canManage ? 6 : 5}
                  className="px-5 py-10 text-center text-sm text-muted-foreground"
                >
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedMember && (
        <MemberCardModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
      {filteredMembers.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            {(currentPage - 1) * itemsPerPage + 1}
            {"–"}
            {Math.min(
              currentPage * itemsPerPage,
              filteredMembers.length,
            )}{" "}
            of {filteredMembers.length} members
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1),
                )
              }
              disabled={currentPage === 1}
              className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-[#203264] transition hover:bg-[#EEF3FB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              disabled={currentPage === totalPages}
              className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-[#203264] transition hover:bg-[#EEF3FB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
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
  type: "member" | "account" | "profile";
  value: string;
}) {
  let styles = "bg-gray-100 text-gray-700";
  let label = value.replaceAll("_", " ");

  if (type === "member") {
    if (value === "active") {
      styles = "bg-green-100 text-green-700";
      label = "Active";
    } else if (value === "inactive") {
      styles = "bg-slate-100 text-slate-600";
      label = "Inactive";
    }
  }

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