# Gemini decision-support server foundation

The database, existing deterministic analytics, weekly inactivity calculation,
and follow-up history remain the source of truth. Gemini interprets an approved
aggregate report and offers optional operational suggestions for human review.
It cannot query Supabase, calculate authoritative KPIs, change any record, create
follow-ups, assign roles, change thresholds, or take action.

There is no AI UI, route handler, public prompt endpoint, automatic Reports call,
conversation, job, cache, history table, or saved response in this pass.

## Server usage and authorization

```ts
import { generateDecisionSupportInsights } from "@/lib/ai/server";

// Call only after a future explicit user action, not during ordinary Reports rendering.
const result = await generateDecisionSupportInsights({
  branchId: selectedAccessibleBranchId, // omit for all accessible branches
  range: { preset: "last_30_days" },
  grouping: "week",
});
if (!result.ok) {
  // Render only result.error.message; never a provider exception.
}
```

The function first calls existing `requirePermission("reports.view")`. Normal
login/access-denied redirects are preserved. Runtime Zod validation accepts only
the Reports `AnalyticsRequest` filter shape: branchId, range and grouping.
Unknown keys (including posted analytics, arbitrary prompts and model settings),
invalid/reversed custom dates and invalid grouping are rejected.

Existing `getAnalyticsBranchOptions` resolves the permitted branch descriptors.
An inaccessible selection fails before any provider call; no scope means no
generation. `getAnalyticsOverview` then independently authenticates and checks
scope, obtaining exactly the same typed report used by the dashboard. All means
all **accessible** branches, including the existing scope helper's administrator
behavior. No AI code checks role names or imports a Supabase client. Supporting
access/metadata reads share the analytics request context where React provides
it; operational inputs/aggregations are loaded only through the existing loader.

Expected failures return `{ ok: false, error: { code, message } }`. Authorization
redirects remain framework control flow; they are not converted into success or
zero-data insights. Next control-flow exceptions are rethrown before sanitizing
unexpected errors.

## SDK, model and environment

Installed dependencies: official `@google/genai` 2.x and Zod 4.x. The legacy
`@google/generative-ai` package is not used. All executable AI files have a
`server-only` guard; future client components may import types with `import type`
but must never import the provider/config/server files.

Add to `.env.local` or server deployment secrets:

```dotenv
GEMINI_API_KEY=your-own-server-secret
# Optional. Omit/leave blank for the centralized default in config.ts.
GEMINI_MODEL=gemini-3.5-flash-lite
```

`.env.example` contains blank placeholders, including the application's existing
Supabase variable names. Never use `NEXT_PUBLIC_` for Gemini settings. No key is
read at import time and no client is created until explicit generation, so a
missing key does not affect builds or Reports. Missing/malformed configuration
returns a fixed safe error without exposing values.

The default is a specific stable text model with structured-output support,
reviewed against Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
on 2026-10-29. The single default lives in `config.ts`; a deployment can override
it with a compatible model available to its Google project. Automated tests use
fake configuration and mocked providers, not a real key or model request.

The provider uses the current [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
via `client.interactions.create`, `store: false`, no background execution, no
tools, no conversation history, no automatic continuation and no SDK retries.
Structured JSON uses `response_format: { type: "text", mime_type:
"application/json", schema }`, following the [official structured-output guide](https://ai.google.dev/gemini-api/docs/structured-output).
Only a completed response with non-empty `output_text` proceeds to validation.
Provider interaction IDs, raw responses and SDK metadata are not returned.

## Data sent to Gemini

`buildDecisionSupportInput` explicitly selects scalar fields and reconstructs
every nested array. Runtime validation enforces dates, finite nonnegative
aggregates, known service/method/outcome/contribution enums, and exact monetary
decimal strings. Extra properties added to an analytics DTO cannot hitchhike
into the payload. An unexpected source shape fails before transmission.

| Area | Included aggregates |
| --- | --- |
| Context | Inclusive Manila date range, grouping, current as-of date, selected/all-accessible scope mode and branch count |
| Membership | Current non-archived count, record additions/trend, missing first-attendance count |
| Attendance | Completed services, physical check-ins, unique attendees, average, service-type and grouped trends, weekly unique counts and availability flags |
| Inactivity | Existing derived active/inactive/unknown/calculable counts, inactive percentage, average streak and one-week-away count |
| Follow-ups | Range activity/method/outcome/trend and separately defined latest-member/needs/overdue/outcome aggregates |
| Contributions | Exact total/average strings, count, type breakdown and trend, including anonymous contributions |
| Baptisms | Dated total/water/Holy Ghost/trend and separate undated-record count |
| Branches | Anonymous Branch aliases, active flag, own threshold and compact aggregate comparison |

Never sent: branch IDs/codes/display names, member/account/profile IDs or names,
email, phone, addresses, raw attendance, individual contribution identities,
follow-up notes, operational notes or arbitrary free text. Branch display names
are mapped to aliases **only in the authorized return value**, after generation,
for a future UI to show local context. Aliases are request-local and do not
establish a persistent anonymous identity or guarantee statistical anonymity
for a small population.

Money remains the analytics layer's decimal strings through mapping, prompt
serialization, evidence validation and return. There is no Number/float money
aggregation, division or rounding. The AI may quote supplied amounts, not derive
new totals, shares or forecasts.

## Structured result, evidence and prompt version

Prompt version `1` and all instructions live in
`prompts/decision-support.ts`. The output schema has:

- `executiveSummary`: bounded plain text.
- `keyFindings`: at most five, each with title, observation, evidence paths and
  severity (`info`, `attention`, `important`).
- `recommendations`: at most four, each with title, optional suggestion,
  rationale, evidence paths and priority (`low`, `medium`, `high`).
- `limitations`: one to six bounded strings.

`evidence` is an array of exact dot paths such as
`inactivity.derivedInactiveMembers` or `attendance.trend.0.physicalCheckIns`.
Both findings and recommendations require one to four citations. The server
requires those paths to exist as scalar leaves in the sanitized input and
returns a deduplicated `evidence` lookup containing the **actual analytics
values**, rather than accepting a value invented by Gemini. Paths are looked up
in a prebuilt Map, never executed or used to traverse arbitrary source objects.

The same Zod schema supplies the provider JSON Schema and validates the parsed
response locally. Unknown fields, invalid enums, oversized/blank prose, excessive
items, invalid JSON/fences, incomplete responses, unknown evidence paths and
novel numeric literals are rejected; nothing attempts to repair malformed prose.
Numeric literal comparison uses decimal text so very large amounts stay exact.
It permits grouping separators and equivalent trailing zeroes but does not round
or calculate a new metric. Spellings/relationships/meaning cannot be fully
verified by this check: a valid existing path or number can still be misused in
prose. Structured output is not a guarantee of factual correctness.

Successful results contain `advisory: true`, the validated insight, resolved
evidence, prompt version, configured model, server generation timestamp,
reporting context, and local branch alias/display-name mapping. No response is
persisted. A future UI must render strings as escaped text, label them advisory,
show their source context and offer human review rather than execute suggestions.

The prompt requires supplied evidence only; no invented/private facts, individual
names, unsupported calculations/forecasts, causal claims, theological judgments,
financial promises, blame, branch rankings, mandatory decisions or automatic
actions. It preserves record-creation vs membership-start semantics, current vs
range state, unknown/null values, sparse/partial weekly periods, latest follow-up
supersession and undated baptism handling. Lack of evidence should produce a
limitation or empty findings/recommendations, not fabricated certainty.

## Bounds and errors

Central limits are a 100,000-byte sanitized input, 4,096 requested output tokens,
24,000 response characters and a 30-second provider deadline. Input is never
silently truncated or reaggregated; choose a shorter/coarser/scoped report if it
does not fit. A local deadline rejects even a non-cooperative SDK promise, and
AbortController plus SDK HTTP timeout cancel the local request. Client abort does
not guarantee Google stopped computing or billing. `store: false` disables the
retrievable interaction history; it is not a blanket guarantee about all
provider processing/retention under the project's Google service terms.

Missing configuration, analytics failure, oversized input, HTTP 429, timeout,
provider failure and invalid output have distinct fixed safe error codes.
Application AI logs contain only those codes, never keys, prompts, aggregate
payloads, raw SDK errors, output or stack traces. Keep SDK debug logging disabled.
No retry, automatic model fallback, background continuation or cache hides a
failed generation or adds unnoticed calls.

## Tests and decisions before UI

Run `node --test tests/ai-*.test.cjs tests/analytics.test.cjs tests/reports-ui.test.cjs tests/inactivity*.test.cjs tests/follow-ups-*.test.cjs`,
`npm run build`, `npx tsc --noEmit`, targeted ESLint on `lib/ai`, and
`git diff --check`. The optional PostgreSQL aggregation suite is unchanged and
documented by the analytics foundation. No automated test needs a Gemini key.

Before adding the UI, choose the explicit generation action, who may incur API
costs within reports.view, per-account/request cost controls, and deployment
model/quota. Review sample results against known aggregate fixtures with an
approved project before calling them dependable advice. Decide how to present
alias names, evidence, advisory status, report context and stale results when
filters change. Existing historical transfer/reactivation/eligibility gaps and
small-population inference limits remain; AI cannot fill them. Add no automatic
generation, storage or operational actions as a side effect of that UI work.
