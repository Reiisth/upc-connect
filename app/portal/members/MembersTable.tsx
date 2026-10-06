"use client";

import { useMemo, useState, useEffect } from "react";
import { disconnectMember, archiveMember } from "./actions";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import {
  Archive,
  MailPlus,
  Search,
  SearchX,
  Unplug,
} from "lucide-react";
import MemberCardModal from "./MemberCardModal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { StatusBadge } from "@/components/ui/status-badge";
import { TableActionButton } from "@/components/ui/table-action-button";

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
      <TableActionButton
        type="button"
        icon={<Archive />}
        onClick={() => setOpen(true)}
      >
        Archive
      </TableActionButton>

      <ConfirmActionModal
        open={open}
        title="Archive member?"
        description={`${memberName} will be removed from the active members list, but their profile, attendance, contributions, and other historical records will be preserved.`}
        confirmLabel="Archive"
        variant="danger"
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
          <Select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="lg:w-36"
            aria-label="Sort members"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="active_first">Active First</option>
            <option value="inactive_first">Inactive First</option>
          </Select>

          <Select
            value={memberStatusFilter}
            onChange={(event) =>
              setMemberStatusFilter(event.target.value)
            }
            className="lg:w-44"
            aria-label="Filter by member status"
          >
            <option value="all">All Member Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <Select
            value={accountStatusFilter}
            onChange={(event) =>
              setAccountStatusFilter(event.target.value)
            }
            className="lg:w-44"
            aria-label="Filter by account status"
          >
            <option value="all">All Account Statuses</option>
            <option value="connected">Connected</option>
            <option value="invited">Invited</option>
            <option value="no_account">No Account</option>
          </Select>

          <Select
            value={profileStatusFilter}
            onChange={(event) =>
              setProfileStatusFilter(event.target.value)
            }
            className="lg:w-44"
            aria-label="Filter by profile status"
          >
            <option value="all">All Profile Statuses</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
          </Select>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {filteredMembers.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No members found"
            description={
              search ||
                memberStatusFilter !== "all" ||
                accountStatusFilter !== "all" ||
                profileStatusFilter !== "all"
                ? "No members match your current search or filters. Try adjusting them."
                : "There are no members to display yet."
            }
          />
        ) : (
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Member Status</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Profile Status</TableHead>

                {canManage && (
                  <TableHead>Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedMembers.map((member) => {
                const fullName = [
                  member.first_name,
                  member.middle_name,
                  member.last_name,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="font-medium text-[#203264] transition hover:text-[#5D94E8] hover:underline dark:text-slate-100 dark:hover:text-[#8DB5F0]"
                      >
                        {fullName}
                      </button>
                    </TableCell>

                    <TableCell>
                      {member.email ?? "—"}
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        variant={
                          member.member_status === "active"
                            ? "success"
                            : "muted"
                        }
                      >
                        {member.member_status === "active"
                          ? "Active"
                          : "Inactive"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        variant={
                          member.account_status === "connected"
                            ? "success"
                            : member.account_status === "invited"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {member.account_status === "connected"
                          ? "Connected"
                          : member.account_status === "invited"
                            ? "Invited"
                            : "No Account"}
                      </StatusBadge>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        variant={
                          member.profile_status === "completed"
                            ? "info"
                            : "danger"
                        }
                      >
                        {member.profile_status === "completed"
                          ? "Completed"
                          : "Incomplete"}
                      </StatusBadge>
                    </TableCell>

                    {canManage && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {member.account_status === "no_account" ? (
                            <TableActionButton
                              href={`/portal/members/invite?memberId=${member.id}`}
                              icon={<MailPlus />}
                            >
                              Connect Email
                            </TableActionButton>
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
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      {selectedMember && (
        <MemberCardModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
      {filteredMembers.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1),
                )
              }
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <span className="px-2 text-sm text-slate-500 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
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
      <TableActionButton
        type="button"
        variant="danger"
        icon={<Unplug />}
        onClick={() => setOpen(true)}
      >
        Disconnect
      </TableActionButton>

      <ConfirmActionModal
        open={open}
        title="Disconnect member?"
        description={`${memberName} will no longer be linked to their current login account. Their member profile and records will remain in the system.`}
        confirmLabel="Disconnect"
        variant="danger"
        loading={loading}
        onConfirm={handleDisconnect}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </>
  );
}