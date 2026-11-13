"use client";
import { Pagination } from "@/components/ui/pagination";

import { MemberStatus } from "@/components/ui/member-status";

import { SearchInput, TableToolbar } from "@/components/ui/table-toolbar";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { memberListUrl, type MemberListFilters } from "./list-filters";

import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { disconnectMember } from "./actions";
import { MemberArchiveControl } from "./MemberArchiveControl";
import {
  ExternalLink,
  MailPlus,
  SearchX,
  Unplug,
} from "lucide-react";
import Link from "@/components/ui/intent-link";

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
  member_status: string;
  account_status: string;
  profile_status: string;
  created_at: string;
  is_archived: boolean;

  church_branch:
  | {
    id: string;
    name: string;
  }
  | null;
};

type MembersTableProps = {
  members: Member[];
  paging?: {total: number; sourceCount: number; filters: MemberListFilters; branches: {id:string;name:string}[]};
  canArchive: boolean;
  canLinkAccount: boolean;
};

export default function MembersTable({
  members,
  paging,
  canArchive,
  canLinkAccount,
}: MembersTableProps) {
  const [search, setSearch] = useState(paging?.filters.search ?? "");
  const [memberStatusFilter, setMemberStatusFilter] = useState(paging?.filters.status ?? "all");
  const [accountStatusFilter, setAccountStatusFilter] = useState(paging?.filters.account ?? "all");
  const [profileStatusFilter, setProfileStatusFilter] = useState(paging?.filters.profile ?? "all");
  const [branchFilter, setBranchFilter] = useState(paging?.filters.branch ?? "all");
  const [archiveFilter, setArchiveFilter] = useState(paging?.filters.archive ?? "active");
  const [sortBy, setSortBy] = useState(paging?.filters.sort ?? "newest");
  const [currentPage, setCurrentPage] = useState(paging?.filters.page ?? 1);
  const itemsPerPage = 10;
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const firstFilters = useRef(true);
  const queryKey = JSON.stringify([search,memberStatusFilter,accountStatusFilter,profileStatusFilter,branchFilter,archiveFilter,sortBy,currentPage]);
  useEffect(() => {
    if (!paging) return;
    if (firstFilters.current) { firstFilters.current = false; return; }
    const timeout = setTimeout(() => startTransition(() => router.replace(memberListUrl({search, status: memberStatusFilter, account: accountStatusFilter, profile: profileStatusFilter, branch: branchFilter, archive: archiveFilter, sort: sortBy, page: currentPage}), {scroll:false})), 250);
    return () => clearTimeout(timeout);
    // The stable filter key includes every control; server props must not retrigger navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, router]);


  const branchOptions = useMemo(() => paging?.branches ?? [...new Map(members.flatMap(member => member.church_branch ? [[member.church_branch.id, member.church_branch] as const] : [])).values()].sort((a, b) => a.name.localeCompare(b.name)), [members, paging?.branches]);

  const filteredMembers = useMemo(() => {
    if (paging) return members;
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
    paging,
    search,
    memberStatusFilter,
    accountStatusFilter,
    profileStatusFilter,
    branchFilter,
    archiveFilter,
    sortBy,
  ]);


  const paginatedMembers = paging ? members : filteredMembers.slice(
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

  const previousFilters = useRef(JSON.stringify([search,memberStatusFilter,accountStatusFilter,profileStatusFilter,branchFilter,archiveFilter,sortBy]));
  useEffect(() => {
    const next = JSON.stringify([search,memberStatusFilter,accountStatusFilter,profileStatusFilter,branchFilter,archiveFilter,sortBy]);
    if (paging && previousFilters.current === next) return;
    previousFilters.current = next;
    setCurrentPage(1);
  }, [
    search,
    memberStatusFilter,
    accountStatusFilter,
    profileStatusFilter,
    branchFilter,
    archiveFilter,
    sortBy,
    paging,
  ]);

  return (
    <>
      {refreshing && <p role="status" className="text-xs text-slate-500">Updating members...</p>}
      <TableToolbar>
        <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
          />

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
      </TableToolbar>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {(paging?.sourceCount ?? members.length) === 0 ? (
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
                        <MemberStatus status={member.member_status} className="mt-1" />
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
                                href={`/portal/members/invite?memberId=${member.id}&returnTo=${encodeURIComponent(paging ? memberListUrl(paging.filters) : "/portal/members")}`}
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
      {(paging?.total ?? filteredMembers.length) > 0 && (
        <Pagination label="Members pagination" page={currentPage} pageSize={itemsPerPage} total={paging?.total ?? filteredMembers.length} noun="members" onPageChange={page => setCurrentPage(page)} />
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
