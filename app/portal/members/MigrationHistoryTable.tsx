import Link from "@/components/ui/intent-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatManilaTimestamp } from "@/lib/manila-time";
import type { MigrationEvent } from "@/lib/member-migrations/server";

export function MigrationHistoryTable({ rows, showMember = false }: { rows: MigrationEvent[]; showMember?: boolean }) {
  return <Table mobileCards><TableHeader><TableRow><TableHead>Recorded Date</TableHead>{showMember && <TableHead>Member</TableHead>}<TableHead>Movement</TableHead><TableHead>From</TableHead><TableHead>To</TableHead></TableRow></TableHeader>
    <TableBody>{rows.length ? rows.map(row => <TableRow key={row.id}>
      <TableCell data-label="Recorded date" className="whitespace-nowrap">{formatManilaTimestamp(row.recorded_at)}</TableCell>
      {showMember && <TableCell data-label="Member"><Link preserveContext className="font-medium text-[#365FA6] hover:underline" href={`/portal/members/${row.member_id}/migrations`}>{row.member_name}</Link></TableCell>}
      <TableCell data-label="Movement"><StatusBadge variant={row.kind === "departure" ? "warning" : row.kind === "return" ? "success" : "info"}>{row.kind === "departure" ? "Departure" : row.kind === "return" ? "Return" : "Transfer"}</StatusBadge></TableCell>
      <TableCell data-label="From">{row.from_branch_name ?? "Outside the church"}</TableCell><TableCell data-label="To">{row.to_branch_name ?? "Outside the church"}</TableCell>
    </TableRow>) : <TableRow><TableCell colSpan={showMember ? 5 : 4}><p role="status" className="py-3 text-center text-slate-500">No recorded movements match this selection.</p></TableCell></TableRow>}</TableBody>
  </Table>;
}
