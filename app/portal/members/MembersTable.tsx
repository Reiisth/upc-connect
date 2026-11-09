"use client";

import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { disconnectMember } from "./actions";
import { MemberArchiveControl } from "./MemberArchiveControl";
import {
  ExternalLink,
  MailPlus,
  Search,
  SearchX,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
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
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { matchesMemberColumnFilter } from "./member-filters";

type Member = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  nickname: string | null;
  birth_date: string | null;
  gender: string | null;
  phone_number: string | null;
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
  is_archived: boolean;

  department:
  | {
    name: string;
  }
  | null;

  church_branch:
  | {
    id: string;
    name: string;
  }
  | null;
};

type MembersTableProps = {
  members: Member[];
  canArchive: boolean;
  canLinkAccount: boolean;
};

export default function MembersTable({
  members,
  canArchive,
  canLinkAccount,
}: MembersTableProps) {
  const [search, setSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const [profileStatusFilter, setProfileStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const branchOptions = useMemo(() => [...new Map(members.flatMap(member => member.church_branch ? [[member.church_branch.id, member.church_branch] as const] : [])).values()].sort((a, b) => a.name.localeCompare(b.name)), [members]);

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
        member.member_status.toLowerCase().includes(query) ||
        member.account_status.toLowerCase().includes(query) ||
        member.profile_status.toLowerCase().includes(query);

      const matchesMemberStatus = matchesMemberColumnFilter(member.member_status, memberStatusFilter);

      const matchesAccountStatus = matchesMemberColumnFilter(member.account_status, accountStatusFilter);

      const matchesProfileStatus = matchesMemberColumnFilter(member.profile_status, profileStatusFilter);
      const matchesArchive = archiveFilter === "all" ||
        (archiveFilter === "active" && !member.is_archived) ||
        (archiveFilter === "archived" && member.is_archived);

      return (
        (branchFilter === "all" || member.church_branch?.id === branchFilter) &&
        matchesSearch &&
        matchesMemberStatus &&
        matchesAccountStatus &&
        matchesProfileStatus &&
        matchesArchive
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
    branchFilter,
    archiveFilter,
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

  const hasActions = canArchive || canLinkAccount;
  const hasClearableFilters = Boolean(
    search.trim() || branchFilter !== "all" || memberStatusFilter !== "all" || accountStatusFilter !== "all" || profileStatusFilter !== "all",
  );

  function clearFilters() {
    setSearch("");
    setBranchFilter("all");
    setMemberStatusFilter("all");
    setAccountStatusFilter("all");
    setProfileStatusFilter("all");
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    memberStatusFilter,
    accountStatusFilter,
    profileStatusFilter,
    branchFilter,
    archiveFilter,
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

        <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-3 lg:flex">
          <Select value={branchFilter} onChange={event => setBranchFilter(event.target.value)} className="lg:w-44" aria-label="Filter members by branch">
            <option value="all">All branches</option>
            {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
          <Select value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)} className="lg:w-36" aria-label="Filter by archive status">
            <option value="active">Active Members</option>
            <option value="archived">Archived Members</option>
            <option value="all">All Members</option>
          </Select>
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

        </div>
        {hasClearableFilters && <ClearFiltersButton onClick={clearFilters} className="self-center" />}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {members.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No members found"
            description="There are no members in this branch and archive view."
          />
        ) : (
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead><ColumnHeading label="Name"><TableColumnFilter label="Member Status" value={memberStatusFilter} onChange={setMemberStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></ColumnHeading></TableHead>
                <TableHead><ColumnHeading label="Account Status"><TableColumnFilter label="Account Status" value={accountStatusFilter} onChange={setAccountStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "connected", label: "Connected" }, { value: "invited", label: "Invited" }, { value: "no_account", label: "No Account" }]} /></ColumnHeading></TableHead>
                <TableHead><ColumnHeading label="Profile Status"><TableColumnFilter label="Profile Status" value={profileStatusFilter} onChange={setProfileStatusFilter} options={[{ value: "all", label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "incomplete", label: "Incomplete" }]} /></ColumnHeading></TableHead>

                {hasActions && (
                  <TableHead>Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasActions ? 4 : 3}>
                    <p role="status" className="py-3 text-center text-sm text-slate-500">
                      No members match the current filters.
                    </p>
                  </TableCell>
                </TableRow>
              ) : paginatedMembers.map((member) => {
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
                      <div className="flex items-start gap-3">
                        <span tabIndex={0} aria-label={`Member status: ${member.member_status === "active" ? "Active" : "Inactive"}`}
                          className={`group mt-1 inline-flex h-3 shrink-0 items-center rounded-full outline-none transition-all hover:h-6 focus:h-6 focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${member.member_status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}>
                          <span className="h-3 w-3 rounded-full" aria-hidden="true" />
                          <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">{member.member_status === "active" ? "Active" : "Inactive"}</span>
                        </span>
                        <div className="min-w-0">
                      <Link
                        href={`/portal/members/${member.id}`}
                        className="block w-full text-left font-medium text-[#203264] transition hover:text-[#5D94E8] hover:underline"
                      >
                        <span className="flex w-full flex-col items-start gap-1 text-left"><span className="inline-flex items-center gap-1.5">{fullName}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></span>
                          {member.is_archived && <StatusBadge variant="muted">Archived</StatusBadge>}
                        </span>
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{member.church_branch?.name ?? "Not assigned"}</p>
                        </div>
                      </div>
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

                    {hasActions && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {!member.is_archived && canLinkAccount && (
                            member.account_status === "no_account" ? (
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
                            )
                          )}

                          {canArchive && (
                            <MemberArchiveControl
                              memberId={member.id}
                              memberName={fullName}
                              archived={member.is_archived}
                              compact
                            />
                          )}
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
      {filteredMembers.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
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

            <span className="px-2 text-sm text-slate-500">
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

function ColumnHeading({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-1"><span>{label}</span>{children}</div>;
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
