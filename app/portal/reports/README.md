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

## Validation and limitations

Run `node --test tests/reports-ui.test.cjs tests/analytics.test.cjs tests/inactivity*.test.cjs tests/follow-ups-*.test.cjs`,
`npm run build`, targeted ESLint, and `git diff --check`.
The analytics PostgreSQL suite remains independently opt-in as documented in
`lib/analytics/README.md`.

The page is intentionally long and uses simple charts with explicit grouping.
Large category lists are more precise in the accompanying scrollable data tables.
Historical membership/branch eligibility limitations remain as documented by the
analytics foundation. No UI presentation fills those missing facts. No AI,
exports, scheduled reports, saved layouts, or snapshots are included.
