# Reports dashboard

`/portal/reports` is a server-rendered, Reports-permission-protected dashboard.
All request data stays under Suspense. The shared analytics server context
authenticates `reports.view` and loads only existing branch-scope descriptors.
One `getAnalyticsOverview` call supplies every section; charts make no requests.
The analytics RPC and metric definitions are unchanged.

## Filters

The GET form persists `branch`, `range`, `grouping`, and custom `from`/`to` in
search params. Omitted branch means all accessible branches; omitted range and
grouping mean last 30 days and weekly. Presets use the analytics Manila-aware
date utilities. Unknown presets/groupings, repeated values, missing custom dates,
invalid calendar dates, and reversed ranges do not execute analytics. An
inaccessible branch redirects to access denied, and the loader validates scope
again. Date fields are enabled only for Custom. Back/forward and refresh restore
applied filters; changes apply together on submit.

## Presentation

Shared cards, tables, form fields, empty states, and skeletons follow the existing
light-only system. Mobile filters/cards stack, chart containers shrink to their
parents, and tables scroll horizontally. Section links help navigate the long
dashboard. Every non-empty chart has a collapsible data table for keyboard and
screen-reader access. Invalid filters and failed data loads are distinct states;
a failed load never renders a zero-data dashboard or raw database errors.

Chart.js with react-chartjs-2 uses registered line/bar elements only, without a
date adapter or custom SVG chart framework. Charts render the DTO's existing
buckets; sparse series are labelled as such and not reaggregated. Weekly activity
stays weekly. Null eligibility rates and other undefined averages/percentages
display Unavailable. Current derived inactivity/latest follow-ups/data quality
are labelled separately from selected-range activity. Member Records Added is
explicitly record creation rather than official membership growth.

## Exact money

The operational single-record formatter rejects aggregate amounts above its
safe-integer cents limit. `formatReportMoney` instead groups digits directly in
the supplied decimal string, preserving all cents without Number conversion.
For chart geometry only, BigInt cents produce relative 0–100 coordinates against
the largest amount. Relative axes are labelled; exact original peso strings
appear in tooltips and data tables. Components never sum money or compute
financial averages, inactivity, attendance eligibility, or follow-up state.

## AI Decision Support

The dedicated section follows all analytics and branch comparison, with a link
in the dashboard section navigation. **Generate AI Insights** is the only trigger;
ordinary loads, filter changes, refreshes and analytics requests never call Gemini.
Reports still works with no Gemini key. Existing `reports.view` permission and
branch scope apply, including custom roles.

The narrow server action delegates to the existing AI entry. The client sends
only validated applied branch/date/grouping intent, freezing the inclusive dates
actually displayed into a custom range. The server authenticates and validates
again and loads fresh aggregates; it does not trust posted analytics. Returned
context labels selected/all-accessible branches, dates, grouping and current-state
reference date. A server re-read may include data updated since the dashboard load.

During generation only the AI button is disabled; a live status announces
“Analyzing report data...”. Client locking and a server 30-second cooldown per
authenticated user/normalized filter combination prevent duplicate work. The
server claim also protects concurrent pending work. Its bounded in-memory state
is process-local, not shared across replicas/serverless instances or restarts,
and is not a global quota. Admitted failed attempts also consume the cooldown;
scope/filter/configuration rejections do not. See `lib/ai/README.md` for deployment
limits and shared platform rate-limiter guidance.

Results show an AI-generated Executive Summary, Key Findings with readable
server-resolved evidence and severity text, Advisory Recommendations with rationale
and priority text, and all model Limitations. Leadership review is required and
the always-visible notice asks users to verify important conclusions against
Reports. There are no mutation controls. Privacy text beside the button discloses
aggregate-only analysis and exclusion of member names, contact details, attendance
rows, contribution identities and follow-up notes. Money preserves exact strings;
null evidence stays Unavailable. Model prose renders as escaped text.

**Regenerate Insights** replaces the in-memory result on success and respects the
same cooldown. A failed regeneration shows a controlled error while retaining the
previous valid result. Missing configuration, usage limits, timeout, provider,
invalid-output and cooldown failures show safe messages; raw errors/payloads are
never rendered. There is no chat, response history, database or browser storage.
Refresh may clear results. Editing/submitting any filter immediately discards the
AI component/result, including late responses, and disables generation until
Apply filters. Applying different filters creates a new component too. Existing
provider work may finish after the result is discarded.

## Validation and limitations

Run `node --test tests/ai-*.test.cjs tests/reports-ui.test.cjs tests/analytics.test.cjs tests/inactivity*.test.cjs tests/follow-ups-*.test.cjs`,
`npm run build`, `npx tsc --noEmit`, targeted ESLint, and `git diff --check`.
The analytics PostgreSQL suite remains independently opt-in as documented in
`lib/analytics/README.md`.

The page is intentionally long and uses simple charts with explicit grouping.
Large category lists are more precise in the accompanying scrollable data tables.
Historical membership/branch eligibility limitations remain as documented by the
analytics foundation. No UI presentation or AI interpretation fills those missing
facts. Exports, scheduled reports, saved layouts and snapshots are not included.
Automated AI tests need no real key. Live authenticated browser and Gemini QA
remain separate deployment checks, including the process-local cooldown limit.
