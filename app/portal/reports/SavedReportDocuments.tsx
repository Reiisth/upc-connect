"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportDocumentRow } from "@/lib/ai/report-documents";
import { getSavedReportDocuments } from "./actions";

export default function SavedReportDocuments({ refreshKey }: { refreshKey: string }) {
  const [selection, setSelection] = useState({ key: refreshKey, page: 1 });
  const page = selection.key === refreshKey ? selection.page : 1;
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<{ rows: ReportDocumentRow[]; total: number; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${refreshKey}:${page}:${retry}`;
  useEffect(() => {
    let active = true;
    setError(null);
    getSavedReportDocuments(page).then(response => {
      if (!active) return;
      if (response.ok) setData({ rows: response.rows, total: response.total, key });
      else setError(response.error);
    }).catch(() => { if (active) setError("Saved reports could not be loaded. Please try again."); });
    return () => { active = false; };
  }, [page, key]);
  const loaded = data?.key === key;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 5));
  return <section aria-labelledby="saved-report-documents-title" className="space-y-4 border-t pt-5">
    <div><h3 id="saved-report-documents-title" className="font-radio-canada text-lg font-semibold text-[#203264]">Report Documents</h3>
      <p className="mt-1 text-sm text-slate-500">Your saved reports, newest first. Open a report to print it or save it as PDF.</p></div>
    {error ? <div role="alert" className="text-sm text-red-700">{error}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => setRetry(value => value + 1)}>Retry</Button></div> : !loaded ? <Skeleton className="h-32 w-full" aria-label="Loading report documents" /> : !data.rows.length ? <EmptyState title="No report documents" description="Generate AI Insights to save your first report document." /> : <>
      <Table aria-label="Saved report documents" className="min-w-[550px]">
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{data.rows.map(row => <TableRow key={row.id}>
          <TableCell className="whitespace-nowrap"><time dateTime={row.created_at}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(row.created_at))}</time><p className="text-xs text-slate-400">Asia/Manila</p></TableCell>
          <TableCell className="max-w-lg"><p className="line-clamp-3 text-sm text-slate-600">{row.description}</p></TableCell>
          <TableCell><div className="flex flex-col items-start gap-2">
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><a href={`/api/reports/documents/${row.id}`} target="_blank" rel="noopener noreferrer"><Printer aria-hidden="true" />Open / Print</a></Button>
            <a href={`/api/reports/documents/${row.id}?download=1`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#203264]"><Download className="h-3.5 w-3.5" aria-hidden="true" />Download</a>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <nav aria-label="Report documents pagination" className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-500">Showing {(page - 1) * 5 + 1}-{Math.min(page * 5, data.total)} of {data.total} documents</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setSelection({ key: refreshKey, page: page - 1 })}>Previous</Button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setSelection({ key: refreshKey, page: page + 1 })}>Next</Button>
        </div>
      </nav>
    </>}
  </section>;
}
