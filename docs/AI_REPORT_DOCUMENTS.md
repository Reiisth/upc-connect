# Saved AI report documents

Generate AI Insights retains the validated on-screen result and saves an immutable
snapshot of that result in public.ai_report_documents. Storage includes verified
insight prose, resolved evidence, reporting range/grouping/as-of date, server-known
branch labels, model, prompt version and generation timestamp. No raw operational
records, prompts, provider responses or API keys are saved. Invalid/provider-failed
results do not create documents. Storage failure keeps the inline result but shows
an explicit unsaved-document warning. Regeneration creates a separate document.
The existing authorization, validation, cooldown and aggregate-only provider flow
remain in force. A generation that finishes after navigation may still be saved.

Documents are private to the generating account. Every list, open and download
requires an active account, reports.view and current access to every stored branch.
Losing any branch hides the whole snapshot rather than partially exposing it.
Direct authenticated writes are forbidden; authenticated SELECT has matching RLS.
The table has owner/date ordering, a creation-date column, a brief summary, and
server-side pagination of five rows. Lists fetch metadata only. No automatic AI
call occurs while listing or opening saved documents.

Open / Print opens an authenticated standalone HTML document in a new tab.
Download saves the same self-contained .html document. It can be opened offline
and printed, or saved as PDF using the browser print dialog. Generated text is
HTML-escaped. Context, evidence, advice, limitations and the AI advisory warning
are included. Print CSS hides controls and supports multi-page A4 output without
clipping long content. Responses use private no-store headers. No public bucket,
public URL or additional external document-rendering service is introduced.

Migration: 20261107120000_ai_report_documents.sql. Applied locally without reset;
existing operational data is preserved. Deploy this migration before deploying
the application change to another environment. The baseline is unchanged.

Validation: dedicated authorization/pagination/escaping/save-failure tests;
real local RLS tests for non-owner reads and forbidden authenticated inserts;
browser six-document persistence/reload, five-plus-one pagination, HTML download,
print-to-PDF layout, unauthenticated denial and other-owner 404. Tests use verified
fixture insights with a stubbed provider and the real save path: no paid/live
Gemini call is needed. Temporary QA documents are removed afterward.
