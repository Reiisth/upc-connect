"use client";

import Link from "next/link";
import { Select } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ExternalLink,
  RotateCcw,
  Search,
  SearchX,
  UserPlus,
} from "lucide-react";

import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";

import {
  archiveMemberAccount,
  restoreMemberAccount,
} from "./actions";

import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ClearFiltersButton } from "@/components/ui/clear-filters-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionButton } from "@/components/ui/table-action-button";
import { TableColumnFilter } from "@/components/ui/table-column-filter";

type Account = {
  canChangeAccount: boolean;
  userId: string;
  email: string;
  members: string[];
  archivedAt: string | null;
};

type MemberAccountsTableProps = {
  accounts: Account[];
  canArchive: boolean;
  canRestore: boolean;
  canLinkAccount: boolean;
};

export default function MemberAccountsTable({
  accounts,
  canArchive,
  canRestore,
  canLinkAccount,
}: MemberAccountsTableProps) {
  const [search, setSearch] = useState("");
  const [memberCountFilter, setMemberCountFilter] = useState("all");
  const [sortBy, setSortBy] = useState("email-asc");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedAccount, setSelectedAccount] = useState<{
    account: Account;
    action: "archive" | "restore";
  } | null>(null);

  const [displayedAccounts, setDisplayedAccounts] = useState(accounts);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setDisplayedAccounts(accounts);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return displayedAccounts.filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        account.email.toLowerCase().includes(normalizedSearch) ||
        account.members.some((member) =>
          member.toLowerCase().includes(normalizedSearch),
        );

      const matchesMemberCount =
        memberCountFilter === "all" ||
        (memberCountFilter === "single" &&
          account.members.length === 1) ||
        (memberCountFilter === "multiple" &&
          account.members.length > 1);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !account.archivedAt) ||
        (statusFilter === "archived" && !!account.archivedAt);

      return matchesSearch && matchesMemberCount && matchesStatus;
    }).sort((a, b) => {
      const emailOrder = a.email.localeCompare(b.email, "en", { sensitivity: "base", numeric: true });
      if (sortBy === "email-desc") return -emailOrder || a.userId.localeCompare(b.userId);
      if (sortBy === "members-desc") return b.members.length - a.members.length || emailOrder || a.userId.localeCompare(b.userId);
      if (sortBy === "members-asc") return a.members.length - b.members.length || emailOrder || a.userId.localeCompare(b.userId);
      return emailOrder || a.userId.localeCompare(b.userId);
    });
  }, [displayedAccounts, search, memberCountFilter, statusFilter, sortBy]);

  async function handleAccountAction() {
    if (!selectedAccount) return;

    setActionLoading(true);

    try {
      const { account, action } = selectedAccount;

      if (action === "archive") {
        await archiveMemberAccount(account.userId);

        setDisplayedAccounts((current) =>
          current.map((item) =>
            item.userId === account.userId
              ? {
                ...item,
                archivedAt: new Date().toISOString(),
              }
              : item,
          ),
        );
      } else {
        await restoreMemberAccount(account.userId);

        setDisplayedAccounts((current) =>
          current.map((item) =>
            item.userId === account.userId
              ? {
                ...item,
                archivedAt: null,
              }
              : item,
          ),
        );
      }

      setSelectedAccount(null);
    } finally {
      setActionLoading(false);
    }
  }
  const hasFilters =
    search.trim() !== "" ||
    memberCountFilter !== "all" ||
    statusFilter !== "active";
  const hasClearableFilters = search.trim() !== "" || memberCountFilter !== "all" || statusFilter !== "active" || sortBy !== "email-asc";

  function clearFilters() {
    setSearch("");
    setMemberCountFilter("all");
    setStatusFilter("active");
    setSortBy("email-asc");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search member accounts"
            placeholder="Search by email or member name..."
            className="pl-9"
          />
        </div>

        <Select aria-label="Sort member accounts" value={sortBy} onChange={event => setSortBy(event.target.value)} className="sm:w-52">
          <option value="email-asc">Email: A to Z</option>
          <option value="email-desc">Email: Z to A</option>
          <option value="members-desc">Most linked members</option>
          <option value="members-asc">Fewest linked members</option>
        </Select>
        {hasClearableFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      {displayedAccounts.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-5 w-5" />}
          title={
            hasFilters
              ? "No matching accounts"
              : "No member accounts found"
          }
          description={
            hasFilters
              ? "No accounts match your current search or filters. Try adjusting them."
              : "There are currently no member accounts to display."
          }
        />
      ) : (
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead><div className="flex items-center gap-1">Email<TableColumnFilter label="Account Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }, { value: "all", label: "All statuses" }]} /></div></TableHead>
              <TableHead>Linked Members</TableHead>
              <TableHead><div className="flex items-center gap-1">Count<TableColumnFilter label="Linked Member Count" value={memberCountFilter} onChange={setMemberCountFilter} options={[{ value: "all", label: "All accounts" }, { value: "single", label: "1 linked member" }, { value: "multiple", label: "Multiple linked members" }]} /></div></TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredAccounts.length === 0 ? (
              <TableRow><TableCell colSpan={4}><p role="status" className="py-3 text-center text-sm text-slate-500">No accounts match the current filters.</p></TableCell></TableRow>
            ) : filteredAccounts.map((account) => (
              <TableRow key={account.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span tabIndex={0} aria-label={`Account status: ${account.archivedAt ? "Archived" : "Active"}`}
                      className={`group inline-flex h-3 shrink-0 items-center rounded-full transition-all hover:h-6 focus:h-6 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${account.archivedAt ? "bg-slate-400 focus-visible:ring-slate-400" : "bg-emerald-500 focus-visible:ring-emerald-500"}`}>
                      <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" />
                      <span aria-hidden="true" className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-white opacity-0 transition-all group-hover:max-w-24 group-hover:pr-2 group-hover:opacity-100 group-focus:max-w-24 group-focus:pr-2 group-focus:opacity-100">{account.archivedAt ? "Archived" : "Active"}</span>
                    </span>
                    <Link href={`/portal/accounts/${account.userId}`} className="inline-flex items-center gap-1.5 font-medium text-[#203264] hover:underline focus-visible:underline">
                      {account.email}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </Link>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {account.members.map((member) => (
                      <StatusBadge
                        key={member}
                        variant="info"
                      >
                        {member}
                      </StatusBadge>
                    ))}
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge variant="muted">
                    {account.members.length}
                  </StatusBadge>
                </TableCell>


                <TableCell>
                  <div className="flex items-center gap-3">
                    {account.archivedAt && canRestore && account.canChangeAccount ? (
                      <TableActionButton
                        type="button"
                        variant="success"
                        icon={<RotateCcw />}
                        onClick={() =>
                          setSelectedAccount({
                            account,
                            action: "restore",
                          })
                        }
                      >
                        Restore
                      </TableActionButton>
                    ) : !account.archivedAt && canArchive && account.canChangeAccount ? (
                      <TableActionButton
                        type="button"
                        variant="danger"
                        icon={<Archive />}
                        onClick={() =>
                          setSelectedAccount({
                            account,
                            action: "archive",
                          })
                        }
                      >
                        Archive
                      </TableActionButton>
                    ) : null}
                    {!account.archivedAt && canLinkAccount && (
                      <TableActionButton
                        href={`/portal/members/invite?email=${encodeURIComponent(
                          account.email,
                        )}&returnTo=/portal/accounts/members`}
                        icon={<UserPlus />}
                      >
                        Link Members
                      </TableActionButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ConfirmActionModal
        open={selectedAccount !== null}
        title={
          selectedAccount?.action === "archive"
            ? "Archive member account?"
            : "Restore member account?"
        }
        description={
          selectedAccount?.action === "archive"
            ? `Archive ${selectedAccount.account.email}? The account and its linked records will be preserved.`
            : `Restore ${selectedAccount?.account.email}? The account will return to the active accounts list.`
        }
        confirmLabel={
          selectedAccount?.action === "archive"
            ? "Archive Account"
            : "Restore Account"
        }
        variant={
          selectedAccount?.action === "archive"
            ? "danger"
            : "default"
        }
        loading={actionLoading}
        onConfirm={handleAccountAction}
        onClose={() => {
          if (!actionLoading) {
            setSelectedAccount(null);
          }
        }}
      />
    </div>
  );
}

