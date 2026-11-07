import { getReportDocument } from "@/lib/ai/report-documents";
import { renderReportDocument } from "@/lib/ai/report-document-html";

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const document = await getReportDocument(documentId);
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  if (!document) return new Response("Report document not found.", { status: 404, headers });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(renderReportDocument(document.result), { headers: {
    ...headers, "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="upc-report-${document.created_at.slice(0, 10)}-${documentId}.html"`,
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  } });
}
